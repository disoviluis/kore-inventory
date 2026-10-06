import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

export default async function run(page) {
  const origin = new URL(page.url()).origin;
  const requests = [];
  const documents = [
    { id: 1, tipo: 'terminos', version: 'qa-1', titulo: 'Terminos de prueba', hash: 'terms-hash', contenido: 'Documento exclusivo de la prueba local.', operador_nombre: 'Operador QA', operador_nit: 'QA', operador_contacto: 'qa@example.com' },
    { id: 2, tipo: 'privacidad', version: 'qa-1', titulo: 'Privacidad de prueba', hash: 'privacy-hash', contenido: 'Documento exclusivo de la prueba local.' }
  ];
  const user = { id: 1, email: 'admin@example.com', tipo_usuario: 'super_admin', estado_verificacion: 'legado', mfa_activo: false, requiere_seguridad: false };
  let smtp = { configured: false, source: 'sin_configurar', version: 0 };
  await page.addInitScript(userData => {
    localStorage.setItem('token', 'cookie'); localStorage.setItem('usuario', JSON.stringify({ ...userData, nombre: 'QA', apellido: 'Admin' }));
    localStorage.setItem('empresaActiva', JSON.stringify({ id: 42, nombre: 'Empresa QA', estado: 'activa' }));
  }, user);
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url());
    let body;
    try { body = request.postDataJSON(); } catch { body = null; }
    requests.push({ pathname: url.pathname, method: request.method(), body, headers: request.headers() });
    let data = {};
    if (url.pathname.startsWith('/api/dashboard/')) { await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: false }) }); return; }
    if (url.pathname === '/api/public/documentos-legales') data = documents;
    else if (url.pathname === '/api/super-admin/configuracion/smtp') {
      if (request.method() === 'PUT') smtp = { ...body, password: undefined, configured: true, credentialStored: true, source: 'global', version: smtp.version + 1, lastTestStatus: 'pendiente' };
      data = smtp;
    }
    else if (url.pathname === '/api/super-admin/configuracion/smtp/prueba') smtp.lastTestStatus = 'exitoso';
    else if (url.pathname === '/api/super-admin/roles-globales') data = [];
    else if (url.pathname === '/api/auth/permisos/modulos') data = { modulos: [] };
    else if (url.pathname === '/api/auth/permisos') data = { permisos: [] };
    else if (url.pathname === '/api/empresas/42') data = { id: 42, nombre: 'Empresa QA', estado: 'activa', nit: 'QA' };
    else if (url.pathname === '/api/auth/verify') data = { usuario: user };
    else if (url.pathname === '/api/auth/seguridad') data = { usuario: user, documentos: documents, aceptados: [] };
    else if (url.pathname === '/api/auth/invitacion') data = { email: 'real@example.com', tipo: 'invitacion' };
    else if (url.pathname === '/api/super-admin/empresas' || url.pathname === '/api/empresas/usuario/1') data = [{ id: 42, nombre: 'Empresa QA' }];
    else if (url.pathname === '/api/super-admin/accesos') data = [{ id: 17, nombre: 'Persona QA', email: 'ficticio@example.test', activo: 1, tipo_usuario: 'usuario', estado: 'legado', empresas: 'Empresa QA' }];
    else if (url.pathname === '/api/super-admin/solicitudes-suscripcion' || url.pathname === '/api/super-admin/documentos-legales') data = [];
    else if (url.pathname === '/api/roles') data = [{ id: 4, nombre: 'Operador empresa' }];
    else if (url.pathname === '/api/suscripciones/42') data = {
      empresa: { id: 42, estado: 'trial', trial_fin_at: '2026-11-01T00:00:00Z' }, vigente: true, licencia: null, puede_gestionar: true,
      planes: [{ id: 3, nombre: 'Plan QA', precio_mensual: 50000, precio_anual: 500000, max_usuarios_por_empresa: 5, max_productos: 100, max_facturas_mes: 20 }], solicitudes: []
    };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data, message: 'Operacion QA registrada', correo_configurado: true }) });
  });
  await page.context().addCookies([{ name: 'kore_csrf', value: 'qa-csrf', url: origin }]);
  const layouts = [];
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const filename of ['login.html', 'activar-cuenta.html#' + 'a'.repeat(64), 'seguridad-cuenta.html', 'accesos.html', 'suscripcion.html?empresa_id=42', 'documentos-legales.html']) {
      await page.goto(`${origin}/${filename}`);
      if (filename.startsWith('activar')) await page.locator('#activationForm:not(.d-none)').waitFor();
      if (filename.startsWith('accesos')) await page.getByText('Persona QA (#17)').waitFor();
      if (filename.startsWith('suscripcion')) await page.getByText('Plan QA', { exact: true }).first().waitFor();
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
      assert.ok(dimensions.width <= dimensions.viewport + 1, `${filename} overflows ${viewport.width}: ${dimensions.width}`);
      layouts.push({ filename, width: viewport.width, overflow: false });
    }
  }
  await page.goto(`${origin}/activar-cuenta.html#${'a'.repeat(64)}`);
  await page.locator('#activationForm:not(.d-none)').waitFor();
  await page.locator('#accessCode').fill('123456');
  await page.locator('#newPassword').fill('a sufficiently long password');
  await page.locator('#confirmPassword').fill('a sufficiently long password');
  await page.locator('#legal-1').check(); await page.locator('#legal-2').check();
  await page.locator('#activationForm button[type=submit]').click();
  await page.getByText('Cuenta confirmada. Puede iniciar sesion con su correo verificado.').waitFor();
  const activation = requests.find(request => request.pathname === '/api/auth/confirmar-cuenta');
  assert.equal(activation.body.aceptaciones.length, 2);
  assert.equal(activation.body.codigo, '123456');
  assert.equal(activation.headers['x-csrf-token'], 'qa-csrf');
  await page.goto(`${origin}/accesos.html`);
  await page.getByTitle('Invitar o reenviar verificacion').click();
  await page.locator('#inviteEmail').fill('real@example.com');
  await page.locator('#samePersonConfirmed').check();
  await page.locator('#inviteUserForm button[type=submit]').click();
  await page.locator('#inviteResult').getByText('Operacion QA registrada').waitFor();
  const invitation = requests.find(request => request.pathname === '/api/super-admin/usuarios/17/invitacion');
  assert.equal(invitation.body.misma_persona_confirmada, true);
  assert.equal(invitation.body.bloquear_hasta_verificar, false);
  await page.screenshot({ path: path.join(os.tmpdir(), 'kore-accesos-mobile.png'), fullPage: true });
  await page.goto(`${origin}/suscripcion.html?empresa_id=42`);
  await page.locator('#subscription-legal-1').check(); await page.locator('#subscription-legal-2').check();
  await page.locator('#subscriptionRequest button[type=submit]').click();
  await page.getByText('Solicitud pendiente. Super Admin debe confirmar el pago recibido antes de activar la licencia.').waitFor();
  const payment = requests.find(request => request.pathname === '/api/suscripciones/42/solicitudes');
  assert.equal(payment.body.plan_id, 3);
  assert.equal(Object.hasOwn(payment.body, 'monto'), false);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: path.join(os.tmpdir(), 'kore-suscripcion-desktop.png'), fullPage: true });
  await page.goto(`${origin}/dashboard.html`);
  await page.waitForFunction(() => typeof window.cambiarModulo === 'function');
  await page.locator('a[href="#plataformaCollapse"]').click();
  await page.locator('a[href="dashboard.html#configuracion-global"]').click();
  await page.locator('#smtp-global-tab').click();
  await page.locator('#smtpHost').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.getElementById('smtpState').textContent.includes('pendiente'));
  await page.locator('#smtpUser').fill('qa@example.com'); await page.locator('#smtpFromEmail').fill('qa@example.com');
  await page.locator('#smtpPassword').fill('qa-only-fake-credential');
  await page.locator('#smtpGlobalForm button[type=submit]').click();
  await page.waitForFunction(() => document.getElementById('smtpState').textContent.includes('Configuracion global'));
  assert.equal(await page.locator('#smtpPassword').inputValue(), '');
  await page.locator('#smtpTestEmail').fill('qa@example.com');
  await page.locator('#smtpTestButton').click();
  await page.waitForFunction(() => document.getElementById('smtpState').textContent.includes('exitoso'));
  const smtpRequest = requests.find(request => request.pathname === '/api/super-admin/configuracion/smtp' && request.method === 'PUT');
  assert.equal(smtpRequest.body.password, 'qa-only-fake-credential');
  assert.equal(smtpRequest.headers['x-csrf-token'], 'qa-csrf');
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1);
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
    assert.ok(dimensions.width <= dimensions.viewport + 1, `SMTP overflows ${viewport.width}: ${dimensions.width}`);
    layouts.push({ filename: 'dashboard.html#smtp', width: viewport.width, overflow: false });
  }
  await page.screenshot({ path: path.join(os.tmpdir(), 'kore-smtp-mobile.png'), fullPage: true });
  return { layouts, confirmation: 'passed', controlledInvitation: 'passed', serverPricedPlanRequest: 'passed', smtpSaveAndTest: 'passed', screenshots: ['kore-accesos-mobile.png', 'kore-suscripcion-desktop.png', 'kore-smtp-mobile.png'] };
}