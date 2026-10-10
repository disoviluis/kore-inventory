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
  let subscriptionActive = true;
  await page.addInitScript(userData => {
    localStorage.setItem('token', 'cookie'); localStorage.setItem('usuario', JSON.stringify({ ...userData, nombre: 'QA', apellido: 'Admin' }));
    localStorage.setItem('empresaActiva', JSON.stringify({ id: 42, nombre: 'Empresa QA', estado: 'activa' }));
  }, user);
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname === '/api/auth/verify' && (request.headers().referer || '').endsWith('/login.html')) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'QA anonymous login' }) });
      return;
    }
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
    else if (url.pathname === '/api/super-admin/planes/catalogo-modulos') data = ['pos', 'inventario', 'ventas', 'clientes', 'usuarios', 'roles', 'reportes', 'finanzas', 'activos'].map(code => ({ codigo: code, nombre: code.replace(/_/g, ' ') }));
    else if (url.pathname === '/api/super-admin/planes') data = [];
    else if (url.pathname === '/api/super-admin/licencias') data = [];
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
      empresa: { id: 42, estado: 'trial', trial_fin_at: '2026-11-01T00:00:00Z' }, vigente: subscriptionActive, licencia: null, puede_gestionar: true,
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
  await page.locator('button[data-bs-target="#legalPane"]').click();
  await page.locator('#loadPreparedLegal').click();
  assert.equal(await page.locator('#legalVersion').inputValue(), '2.1.2');
  assert.equal(await page.locator('#legalTitle').inputValue(), 'Términos y condiciones del servicio Kore Inventory');
  const preparedTerms = await page.locator('#legalContent').inputValue();
  assert.match(preparedTerms, /Estos Términos regulan el acceso/);
  assert.doesNotMatch(preparedTerms, /borrador|antes de publicar|Anexo A|Procedimientos internos/i);
  assert.equal(await page.locator('#legalReviewed').isChecked(), false);
  await page.screenshot({ path: path.join(os.tmpdir(), 'kore-accesos-mobile.png'), fullPage: true });
  await page.goto(`${origin}/suscripcion.html?empresa_id=42`);
  await page.locator('#subscription-legal-1').check(); await page.locator('#subscription-legal-2').check();
  await page.locator('#subscriptionRequest button[type=submit]').click();
  await page.getByText('Solicitud pendiente. Super Admin debe confirmar el pago recibido antes de activar la licencia.').waitFor();
  const payment = requests.find(request => request.pathname === '/api/suscripciones/42/solicitudes');
  assert.equal(payment.body.plan_id, 3);
  assert.equal(Object.hasOwn(payment.body, 'monto'), false);
  subscriptionActive = false;
  await page.reload();
  await page.getByText('Sin suscripción vigente. Selecciona un plan para solicitar su activación.', { exact: true }).waitFor();
  assert.equal(await page.locator('#subscriptionState').evaluate(element => element.classList.contains('is-current')), false);
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
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('a[href="dashboard.html#planes"]').click();
  await page.locator('[onclick="abrirModalPlan()"]').click();
  await page.locator('#planModal.show').waitFor();
  await page.locator('#planModuleChecks input').first().waitFor();
  await page.locator('#planNombre').fill('Plan QA gestion'); await page.locator('#planPrecioMensual').fill('69900');
  await page.locator('#planMultiBodega').check(); await page.locator('#planReportesAvanzados').check();
  await page.locator('#plan-module-reportes').check(); await page.locator('#plan-module-finanzas').check();
  await page.locator('#planDestacado').check();
  await page.screenshot({ path: path.join(os.tmpdir(), 'kore-plan-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => {
    const content = document.querySelector('#planModal .modal-content');
    const bounds = content.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= innerWidth + 1 && content.scrollWidth <= content.clientWidth + 1;
  });
  const planDimensions = await page.locator('#planModal .modal-content').boundingBox();
  assert.ok(planDimensions.width <= 391);
  await page.screenshot({ path: path.join(os.tmpdir(), 'kore-plan-mobile.png'), fullPage: true });
  const dialogHandler = async dialog => dialog.accept(); page.on('dialog', dialogHandler);
  await page.locator('button[form="planForm"]').click();
  await page.locator('#planModal.show').waitFor({ state: 'hidden' });
  page.off('dialog', dialogHandler);
  const planRequest = requests.find(request => request.pathname === '/api/super-admin/planes' && request.method === 'POST');
  assert.equal(planRequest.body.multi_bodega, 1);
  assert.equal(planRequest.body.reportes_avanzados, 1);
  assert.equal(planRequest.body.max_usuarios_por_empresa, null);
  assert.equal(planRequest.body.soporte_nivel, 'email');
  assert.equal(planRequest.body.destacado, 1);
  layouts.push({ filename: 'dashboard.html#planModal', width: 390, overflow: false });
  await page.route('**/api/public/documentos-legales', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
  await page.goto(`${origin}/documentos-legales.html?tipo=terminos`);
  await page.locator('#legalDocument').getByText('Términos y condiciones del servicio Kore Inventory', { exact: false }).waitFor();
  await page.getByText('Versión 2.1.2 preparada para publicación.', { exact: false }).waitFor();
  assert.equal(await page.locator('#legalDownload').getAttribute('download'), 'terminos-v2.1.2.txt');
  assert.doesNotMatch(await page.locator('#legalDocument').innerText(), /borrador|antes de publicar|Anexo A|Procedimientos internos/i);
  await page.goto(`${origin}/documentos-legales.html?tipo=privacidad`);
  await page.locator('#legalDocument').getByText('Política de Tratamiento de Datos Personales de Kore Inventory', { exact: false }).waitFor();
  assert.equal(await page.locator('#legalDownload').getAttribute('download'), 'privacidad-v2.1.2.txt');
  assert.doesNotMatch(await page.locator('#legalDocument').innerText(), /Procedimientos internos|Anexo de implementación/i);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/dashboard.html?qa=sidebar-mobile`);
  await page.locator('.sidebar-nav.permissions-loaded').waitFor();
  const menuButton = page.locator('#toggleSidebar');
  await menuButton.click();
  assert.equal(await page.locator('#sidebar').evaluate(element => element.classList.contains('active')), true);
  assert.equal(await page.locator('#sidebarOverlay').evaluate(element => element.classList.contains('active')), true);
  assert.equal(await menuButton.getAttribute('aria-expanded'), 'true');
  await page.screenshot({ path: path.join(os.tmpdir(), 'kore-sidebar-mobile.png'), fullPage: true });
  await menuButton.click();
  assert.equal(await page.locator('#sidebar').evaluate(element => element.classList.contains('active')), false);
  await menuButton.click();
  await page.locator('a[href="#plataformaCollapse"]').click();
  await page.locator('#plataformaCollapse.show').waitFor();
  await page.locator('#plataformaSection a[onclick*="configuracion-global"]').click();
  await page.waitForFunction(() => location.hash === '#configuracion-global' && getComputedStyle(document.getElementById('configuracion-globalModule')).display === 'block');
  assert.equal(await page.locator('#sidebar').evaluate(element => element.classList.contains('active')), false);
  return { layouts, confirmation: 'passed', controlledInvitation: 'passed', mobileSidebarToggleAndNavigation: 'passed', legalPreparationAndDownload: 'passed', serverPricedPlanRequest: 'passed', inactiveSubscription: 'passed', smtpSaveAndTest: 'passed', visualPlanEditor: 'passed', screenshots: ['kore-accesos-mobile.png', 'kore-suscripcion-desktop.png', 'kore-smtp-mobile.png', 'kore-plan-mobile.png', 'kore-sidebar-mobile.png'] };
}