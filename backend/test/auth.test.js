const assert = require('node:assert/strict');
const test = require('node:test');
const security = require('../dist/core/auth/auth.security');
const pool = require('../dist/shared/database').default;
const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const { authMiddleware } = require('../dist/core/middleware/auth.middleware');
const { completeAccessChallenge } = require('../dist/core/auth/auth.onboarding');
const { deactivateAccessUser } = require('../dist/core/auth/auth.admin');
const { enforceSubscription, moduleIncluded, addCalendarMonths, requestedCompany, assertPlanQuota } = require('../dist/core/auth/subscription.service');
const { approveSubscriptionRequest } = require('../dist/core/auth/subscription.controller');
const http = require('node:http');
const { validateSmtpConfig, safeSmtpConfig, isPublicSmtpAddress, loadAccessSmtpConfig, describeSmtpFailure } = require('../dist/core/auth/auth.smtp');
const { saveGlobalSmtp } = require('../dist/core/auth/auth.smtp.controller');
const { sendAuthMail } = require('../dist/core/auth/auth.mail');
const nodemailer = require('nodemailer');
const dnsPromises = require('node:dns/promises');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

function responseMock() {
  return {
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('SMTP configuration keeps secrets private and validates TLS and account changes', () => {
  const input = { host: 'smtp.gmail.com', port: 587, security: 'starttls', user: 'test@example.com',
    password: 'private-app-credential', fromEmail: 'test@example.com', fromName: 'Kore Inventory', enabled: true };
  const config = validateSmtpConfig(input);
  const safe = safeSmtpConfig(config);
  assert.equal(safe.credentialStored, true);
  assert.equal(JSON.stringify(safe).includes(input.password), false);
  assert.equal(validateSmtpConfig({ ...input, password: '' }, config).password, input.password);
  assert.throws(() => validateSmtpConfig({ ...input, user: 'other@example.com', password: '' }, config));
  assert.throws(() => validateSmtpConfig({ ...input, port: 465, security: 'starttls' }));
  assert.throws(() => validateSmtpConfig({ ...input, host: '127.0.0.1' }));
  assert.throws(() => validateSmtpConfig({ ...input, fromEmail: 'one,two@example.com' }));
});

async function withDatabaseMock(execute, callback) {
  const originalExecute = pool.execute;
  const originalConnection = pool.getConnection;
  pool.execute = async (sql, params) => [await execute(sql, params), []];
  pool.getConnection = async () => ({
    execute: pool.execute, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {}
  });
  try { return await callback(); }
  finally { pool.execute = originalExecute; pool.getConnection = originalConnection; }
}

test('authentication refuses a missing, default or short signing secret', () => {
  const previous = process.env.JWT_SECRET;
  try {
    for (const secret of ['', 'secret_key_default', 'too-short']) {
      process.env.JWT_SECRET = secret;
      assert.throws(security.getAuthSecret);
    }
    process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-bytes';
    assert.equal(security.protectAuthValue('code').length, 64);
    assert.notEqual(security.protectAuthValue('code'), security.protectAuthValue('other'));
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
});

test('email and new passwords validate types, length and bcrypt byte limit', () => {
  assert.equal(security.normalizeAuthEmail(' Person@Example.com '), 'person@example.com');
  assert.equal(security.normalizeAuthEmail({ email: 'person@example.com' }), null);
  assert.equal(security.normalizeAuthEmail('invalid'), null);
  assert.equal(security.validAuthPassword('short'), false);
  assert.equal(security.validAuthPassword('passwordpassword'), false);
  assert.equal(security.validAuthPassword('a'.repeat(30)), false);
  assert.equal(security.validAuthPassword('a long unique passphrase'), true);
  assert.equal(security.validAuthPassword('a'.repeat(73)), false);
  assert.equal(security.validAuthPassword('\u00e1'.repeat(37)), false);
});

test('MFA secret is encrypted with authenticated encryption and codes cannot replay', () => {
  process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-bytes';
  const secret = authenticator.generateSecret();
  const encrypted = security.encryptAuthSecret(secret);
  assert.notEqual(secret, encrypted);
  assert.equal(security.decryptAuthSecret(encrypted), secret);
  assert.equal(security.validMfaCode(authenticator.generate(secret), encrypted, null), true);
  assert.equal(security.validMfaCode(authenticator.generate(secret), encrypted, Math.floor(Date.now() / 30000)), false);
  assert.throws(() => security.decryptAuthSecret(encrypted.replace(/^./, encrypted[0] === 'a' ? 'b' : 'a')));
});

test('cookie session verifies current active user and rejects stale or revoked sessions', async () => {
  process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-bytes';
  const token = jwt.sign({ id: 17, jti: 'session-17', version: 1 }, security.getAuthSecret(), {
    issuer: 'kore-inventory', audience: 'kore-web', expiresIn: '1h'
  });
  await withDatabaseMock(async sql => {
    assert.match(sql, /u.activo = 1/);
    assert.match(sql, /a.revocada_at IS NULL/);
    assert.match(sql, /s.version_sesion =/);
    return [];
  }, async () => {
    const res = responseMock();
    let next = false;
    await authMiddleware({ cookies: { kore_session: token }, headers: {}, method: 'GET', originalUrl: '/api/ventas', url: '/api/ventas' }, res, () => { next = true; });
    assert.equal(next, false);
    assert.equal(res.statusCode, 401);
  });
});

test('authenticated cookie writes require the server-bound CSRF secret', async () => {
  const token = jwt.sign({ id: 17, jti: 'session-17', version: 1 }, security.getAuthSecret(), {
    issuer: 'kore-inventory', audience: 'kore-web', expiresIn: '1h'
  });
  await withDatabaseMock(async () => [{ id: 17, tipo_usuario: 'usuario', estado_verificacion: 'legado', csrf_hash: security.protectAuthValue('correct') }], async () => {
    const res = responseMock();
    await authMiddleware({ cookies: { kore_session: token }, headers: {}, get: () => 'wrong', method: 'POST', originalUrl: '/api/ventas', url: '/api/ventas' }, res, () => assert.fail('CSRF bypass'));
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.codigo, 'CSRF_INVALIDO');
  });
});

test('wrong confirmation code increments attempts and does not change users or licenses', async () => {
  const writes = [];
  const challenge = { id: 'challenge', usuario_id: 17, intentos: 0, codigo_hash: security.protectAuthValue('challenge:123456'), expira_at: new Date(Date.now() + 600000), codigo_expira_at: new Date(Date.now() + 600000) };
  await withDatabaseMock(async sql => {
    if (sql.startsWith('SELECT * FROM auth_desafios')) return [challenge];
    writes.push(sql);
    return { affectedRows: 1 };
  }, async () => {
    const res = responseMock();
    await completeAccessChallenge({ body: { token: 'a'.repeat(64), codigo: '999999', password: 'a unique long passphrase' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(writes.length, 1);
    assert.match(writes[0], /intentos = intentos \+ 1/);
  });
});

test('consumed and expired challenges cannot activate an account', async () => {
  for (const row of [{ consumido_at: new Date() }, { expira_at: new Date(0) }, { intentos: 5 }]) {
    await withDatabaseMock(async sql => {
      assert.match(sql, /^SELECT \* FROM auth_desafios/);
      return [{ id: 'challenge', expira_at: new Date(Date.now() + 600000), codigo_expira_at: new Date(Date.now() + 600000), ...row }];
    }, async () => {
      const res = responseMock();
      await completeAccessChallenge({ body: { token: 'a'.repeat(64), codigo: '123456', password: 'a unique long passphrase' } }, res);
      assert.equal(res.statusCode, 400);
    });
  }
});

test('deactivation keeps user history and associations instead of deleting records', async () => {
  const statements = [];
  await withDatabaseMock(async sql => {
    statements.push(sql);
    return sql.startsWith('SELECT') ? [{ id: 17, tipo_usuario: 'usuario' }] : { affectedRows: 1 };
  }, async () => {
    const res = responseMock();
    await deactivateAccessUser({ user: { id: 1, tipo_usuario: 'super_admin' }, params: { id: '17' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(statements.some(sql => /^DELETE/i.test(sql)), false);
    assert.equal(statements.some(sql => /version_sesion = version_sesion \+ 1/.test(sql)), true);
  });
});

test('expired companies are restricted even when cron has not changed their state', async () => {
  await withDatabaseMock(async sql => {
    if (sql.includes('FROM usuario_empresa')) return [{ empresa_id: 42 }];
    if (sql.includes('FROM empresas e')) return [{ id: 42, estado: 'trial', trial_vigente: 0 }];
    if (sql.includes('FROM licencias l')) return [];
    assert.fail(sql);
  }, async () => {
    const res = responseMock();
    await enforceSubscription({ user: { id: 17, tipo_usuario: 'usuario', empresa_id: 42 }, params: {}, query: {}, body: {}, originalUrl: '/api/ventas' }, res, () => assert.fail('expired trial bypass'));
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.codigo, 'LICENCIA_INACTIVA_PAGO_PENDIENTE');
  });
});

test('tenant context cannot be switched by conflicting query/body companies', () => {
  assert.throws(() => requestedCompany({ params: {}, query: { empresa_id: 42 }, body: { empresa_id: 43 } }));
  assert.throws(() => requestedCompany({ params: {}, query: { empresa_id: 'invalid' }, body: {} }));
});

test('plan modules and calendar renewals use server rules', () => {
  assert.equal(moduleIncluded('["inventario"]', 'productos'), true);
  assert.equal(moduleIncluded('["inventario"]', 'contabilidad'), false);
  assert.equal(addCalendarMonths(new Date('2026-01-31T14:00:00Z'), 1).toISOString(), '2026-02-28T14:00:00.000Z');
  assert.equal(addCalendarMonths(new Date('2028-02-29T14:00:00Z'), 12).toISOString(), '2029-02-28T14:00:00.000Z');
});

test('quota checks lock the company before counting active products', async () => {
  const statements = [];
  await assert.rejects(() => assertPlanQuota(async sql => {
    statements.push(sql);
    return statements.length === 1 ? [{ max_productos: 3 }] : [{ total: 3 }];
  }, 42, 'productos'), error => error.status === 403);
  assert.match(statements[0], /FOR UPDATE/);
  assert.match(statements[1], /estado = 'activo'/);
});

test('payment approval is idempotent and requires real confirmation', async () => {
  const res = responseMock();
  await approveSubscriptionRequest({ body: { referencia: 'BANK-42' }, params: { id: '2' } }, res);
  assert.equal(res.statusCode, 400);
  const statements = [];
  await withDatabaseMock(async sql => {
    statements.push(sql);
    if (sql.startsWith('SELECT empresa_id')) return [{ empresa_id: 42 }];
    if (sql.startsWith('SELECT id FROM empresas')) return [{ id: 42 }];
    if (sql.startsWith('SELECT * FROM solicitudes_suscripcion')) return [{ estado: 'aprobada', referencia: 'BANK-42', licencia_id: 7 }];
    assert.fail('No write allowed for already approved payment: ' + sql);
  }, async () => {
    const result = responseMock();
    await approveSubscriptionRequest({ body: { referencia: 'BANK-42', pago_confirmado: true }, params: { id: '2' } }, result);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.data.ya_aprobada, true);
    assert.equal(statements.some(sql => /^(UPDATE|INSERT)/.test(sql)), false);
  });
});

test('verification keeps the existing user ID and does not reset an existing company trial', async () => {
  const statements = [];
  const challenge = { id: 'challenge', usuario_id: 17, tipo: 'invitacion', email: 'real@example.com', creado_por: 1,
    codigo_hash: security.protectAuthValue('challenge:123456'), expira_at: new Date(Date.now() + 600000), codigo_expira_at: new Date(Date.now() + 600000), intentos: 0 };
  const documents = [{ id: 1, tipo: 'terminos', hash: 'terms' }, { id: 2, tipo: 'privacidad', hash: 'privacy' }];
  await withDatabaseMock(async (sql, params) => {
    statements.push({ sql, params });
    if (sql.startsWith('SELECT * FROM auth_desafios')) return [challenge];
    if (sql.includes('SELECT u.*, s.estado')) return [{ id: 17, activo: 1, estado: 'legado', email: 'fake@example.test', tipo_usuario: 'admin_empresa', empresa_id_default: 42 }];
    if (sql.includes('SELECT d.* FROM documentos_legales')) return documents;
    if (sql.includes('FROM empresas e JOIN empresas_suscripcion')) return [];
    return { affectedRows: 1 };
  }, async () => {
    const res = responseMock();
    await completeAccessChallenge({ body: { token: 'a'.repeat(64), codigo: '123456', password: 'a unique long passphrase', aceptaciones: documents }, headers: {}, ip: '127.0.0.1' }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(statements.some(entry => /INSERT INTO usuarios\b/.test(entry.sql)), false);
    assert.equal(statements.some(entry => /UPDATE empresas_suscripcion/.test(entry.sql)), false);
    const update = statements.find(entry => /^UPDATE usuarios SET email/.test(entry.sql));
    assert.equal(update.params[0], 'real@example.com');
    assert.equal(update.params[2], 17);
    assert.equal(statements.filter(entry => /INSERT IGNORE INTO aceptaciones_legales/.test(entry.sql)).length, 2);
  });
});

test('early paid renewal starts at the current paid end without cancelling that license', async () => {
  const statements = [];
  const paidEnd = new Date('2026-11-01T15:00:00Z');
  await withDatabaseMock(async (sql, params) => {
    statements.push({ sql, params });
    if (sql.startsWith('SELECT empresa_id FROM solicitudes')) return [{ empresa_id: 42 }];
    if (sql.startsWith('SELECT id FROM empresas')) return [{ id: 42 }];
    if (sql.startsWith('SELECT * FROM solicitudes')) return [{ estado: 'pendiente', plan_id: 3, monto: '50000.00', periodicidad: 'mensual', meses: 1 }];
    if (sql.startsWith('SELECT id FROM pagos_licencias')) return [];
    if (sql.startsWith('SELECT * FROM planes')) return [{ id: 3, max_usuarios_por_empresa: null, max_productos: null, max_facturas_mes: null }];
    if (sql.includes('(SELECT COUNT(*) FROM usuario_empresa')) return [{ usuarios: 5, productos: 50 }];
    if (sql.includes('FROM empresas e')) return [{ id: 42, estado: 'activa' }];
    if (sql.includes('FROM licencias l')) return [{ plan_id: 3, fin_at: paidEnd }];
    if (sql.startsWith('SELECT UTC_TIMESTAMP')) return [{ ahora: new Date('2026-10-06T15:00:00Z') }];
    return { insertId: 70, affectedRows: 1 };
  }, async () => {
    const res = responseMock();
    await approveSubscriptionRequest({ user: { id: 1 }, params: { id: '9' }, body: { referencia: 'BANK-9', pago_confirmado: true, monto_recibido: 50000 } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.fecha_inicio.toISOString(), paidEnd.toISOString());
    assert.equal(res.body.data.fecha_fin.toISOString(), '2026-12-01T15:00:00.000Z');
    assert.equal(statements.some(entry => /UPDATE licencias SET/.test(entry.sql)), false);
  });
});

test('HTTP routes reject cross-origin login, old bearer tokens and CSRF-less logout', async () => {
  const createApp = require('../dist/app').default;
  const server = http.createServer(createApp());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const crossed = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'person@example.com', password: 'a unique long passphrase' }) });
    assert.equal(crossed.status, 403);
    const oldBearer = await fetch(`${origin}/api/auth/verify`, { headers: { Authorization: 'Bearer old-token' } });
    assert.equal(oldBearer.status, 401);
    const token = jwt.sign({ id: 17, jti: 'session-17', version: 1 }, security.getAuthSecret(), { issuer: 'kore-inventory', audience: 'kore-web', expiresIn: '1h' });
    const cookie = `kore_session=${token}; kore_csrf=correct`;
    await withDatabaseMock(async sql => {
      if (sql.startsWith('UPDATE auth_sesiones')) return { affectedRows: 1 };
      return [{ id: 17, tipo_usuario: 'usuario', estado_verificacion: 'legado', csrf_hash: security.protectAuthValue('correct') }];
    }, async () => {
      const verified = await fetch(`${origin}/api/auth/verify`, { headers: { Cookie: cookie } });
      assert.equal(verified.status, 200);
      const smtpDenied = await fetch(`${origin}/api/super-admin/configuracion/smtp`, { headers: { Cookie: cookie } });
      assert.equal(smtpDenied.status, 403);
      const blocked = await fetch(`${origin}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie } });
      assert.equal(blocked.status, 403);
      const closed = await fetch(`${origin}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': 'correct' } });
      assert.equal(closed.status, 200);
      assert.match(closed.headers.get('set-cookie'), /kore_session=/);
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('SMTP rejects private, loopback, mapped and metadata network addresses', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.1', '100.64.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1']) assert.equal(isPublicSmtpAddress(address), false);
  assert.equal(isPublicSmtpAddress('8.8.8.8'), true);
  assert.equal(isPublicSmtpAddress('2606:4700:4700::1111'), true);
});

test('global disabled SMTP overrides enabled environment SMTP and stored passwords stay encrypted', async () => {
  process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-bytes';
  const row = { host: 'smtp.gmail.com', port: 587, seguridad: 'starttls', usuario: 'test@example.com',
    secreto_cifrado: security.encryptAuthSecret('private-app-credential'), remitente_email: 'test@example.com',
    remitente_nombre: 'Kore Inventory', activo: 0, version: 3 };
  await withDatabaseMock(async () => [row], async () => {
    const config = await loadAccessSmtpConfig();
    assert.equal(config.source, 'global');
    assert.equal(config.enabled, false);
    assert.equal(config.password, 'private-app-credential');
    assert.equal(JSON.stringify(safeSmtpConfig(config)).includes(row.secreto_cifrado), false);
  });
});

test('SMTP save encrypts the credential and audits no secret', async () => {
  const writes = [];
  await withDatabaseMock(async (sql, params) => {
    if (sql.startsWith('SELECT')) return [];
    writes.push({ sql, params }); return { affectedRows: 1 };
  }, async () => {
    const res = responseMock();
    await saveGlobalSmtp({ user: { id: 1 }, body: { host: 'smtp.gmail.com', port: 587, security: 'starttls',
      user: 'test@example.com', password: 'private-app-credential', fromEmail: 'test@example.com', fromName: 'Kore Inventory', enabled: true, version: 0 } }, res);
    assert.equal(res.statusCode, 200);
    const insert = writes.find(entry => entry.sql.includes('INSERT INTO auth_smtp_configuracion'));
    assert.equal(security.decryptAuthSecret(insert.params[4]), 'private-app-credential');
    assert.equal(JSON.stringify(writes).includes('private-app-credential'), false);
    assert.equal(JSON.stringify(res.body).includes('private-app-credential'), false);
  });
});

test('SMTP save refuses stale configuration versions without writes', async () => {
  await withDatabaseMock(async sql => {
    if (sql === 'SELECT * FROM auth_smtp_configuracion WHERE id = 1') return [{ host: 'smtp.gmail.com', port: 587,
      seguridad: 'starttls', usuario: 'test@example.com', secreto_cifrado: security.encryptAuthSecret('private-app-credential'),
      remitente_email: 'test@example.com', remitente_nombre: 'Kore Inventory', activo: 1, version: 2 }];
    if (sql.startsWith('SELECT version')) return [{ version: 2 }];
    assert.fail('Stale configuration must not write: ' + sql);
  }, async () => {
    const res = responseMock();
    await saveGlobalSmtp({ user: { id: 1 }, body: { host: 'smtp.gmail.com', port: 587, security: 'starttls',
      user: 'test@example.com', password: '', fromEmail: 'test@example.com', fromName: 'Kore Inventory', enabled: true, version: 1 } }, res);
    assert.equal(res.statusCode, 409);
  });
});

test('invitation mail uses the global sender, pinned public address and verified TLS', async () => {
  const originalTransport = nodemailer.createTransport;
  const originalLookup = dnsPromises.lookup;
  let options;
  let envelope;
  let closed = false;
  const row = { host: 'smtp.example.com', port: 587, seguridad: 'starttls', usuario: 'support@example.com',
    secreto_cifrado: security.encryptAuthSecret('private-app-credential'), remitente_email: 'support@example.com',
    remitente_nombre: 'Kore Inventory', activo: 1, version: 1 };
  nodemailer.createTransport = config => {
    options = config;
    return { sendMail: async mail => { envelope = mail; }, close: () => { closed = true; } };
  };
  dnsPromises.lookup = async () => [{ address: '142.250.0.1', family: 4 }];
  try {
    await withDatabaseMock(async () => [row], async () => {
      await sendAuthMail('invitee@example.com', 'Invitation QA', 'Mock only');
      assert.equal(options.auth.user, 'support@example.com');
      assert.equal(options.host, '142.250.0.1');
      assert.equal(options.tls.servername, 'smtp.example.com');
      assert.equal(options.tls.rejectUnauthorized, true);
      assert.equal(options.requireTLS, true);
      assert.equal(envelope.from.address, 'support@example.com');
      assert.equal(envelope.to, 'invitee@example.com');
      assert.equal(closed, true);
    });
  } finally { nodemailer.createTransport = originalTransport; dnsPromises.lookup = originalLookup; }
});

test('production bootstrap generates a private key once and preserves existing settings', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kore-bootstrap-test-'));
  const script = path.resolve(__dirname, '../../scripts/preparar_acceso_produccion.cjs');
  try {
    fs.mkdirSync(path.join(directory, 'node_modules'), { recursive: true });
    fs.cpSync(path.dirname(require.resolve('dotenv/package.json')), path.join(directory, 'node_modules/dotenv'), { recursive: true });
    const filename = path.join(directory, '.env');
    const initial = 'JWT_SECRET=test-secret-with-more-than-thirty-two-bytes\nKEEP_SETTING=unchanged\n';
    fs.writeFileSync(filename, initial);
    const output = execFileSync(process.execPath, [script, directory], { encoding: 'utf8' });
    const updated = fs.readFileSync(filename, 'utf8');
    const generated = updated.match(/^AUTH_SECURITY_KEY=([a-f0-9]{64})$/m)?.[1];
    assert.ok(generated);
    assert.ok(updated.startsWith(initial));
    assert.equal(output.includes(generated), false);
    assert.match(updated, /APP_PUBLIC_URL=https:\/\/kinventoryservices.com/);
    execFileSync(process.execPath, [script, directory]);
    assert.equal(fs.readFileSync(filename, 'utf8'), updated);
    assert.equal(fs.readdirSync(directory).filter(name => name.startsWith('.env.before-access-')).length, 1);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('SMTP diagnostics classify failure without leaking provider response or credentials', () => {
  const failure = describeSmtpFailure({ code: 'EAUTH', responseCode: 535,
    message: 'sensitive-value', response: 'private-provider-response' });
  assert.equal(failure.code, 'SMTP_AUTENTICACION_RECHAZADA');
  assert.equal(JSON.stringify(failure).includes('sensitive-value'), false);
  assert.equal(JSON.stringify(failure).includes('private-provider-response'), false);
  assert.equal(describeSmtpFailure({ code: 'ETIMEDOUT' }).code, 'SMTP_CONEXION_FALLIDA');
  assert.equal(describeSmtpFailure({ code: 'ENOTFOUND' }).code, 'SMTP_DNS_FALLIDO');
  assert.equal(describeSmtpFailure({ code: 'CERT_HAS_EXPIRED' }).code, 'SMTP_TLS_FALLIDO');
  assert.equal(describeSmtpFailure({ code: 'EENVELOPE' }).code, 'SMTP_REMITENTE_DESTINO_RECHAZADO');
});