const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const backend = path.resolve(process.argv[2] || path.join(__dirname, '../backend'));
const filename = path.join(backend, '.env');
const dotenv = require(path.join(backend, 'node_modules/dotenv'));
const existing = fs.readFileSync(filename, 'utf8');
const settings = dotenv.parse(existing);
if (Buffer.byteLength(settings.JWT_SECRET || '') < 32 || settings.JWT_SECRET === 'secret_key_default') {
  throw new Error('JWT_SECRET no cumple los requisitos; no se modifico la configuracion');
}
if (settings.AUTH_SECURITY_KEY && (Buffer.byteLength(settings.AUTH_SECURITY_KEY) < 32 || settings.AUTH_SECURITY_KEY.startsWith('CLAVE_ALEATORIA_'))) {
  throw new Error('Existe una AUTH_SECURITY_KEY no valida; debe revisarse sin rotarla automaticamente');
}
if (settings.APP_PUBLIC_URL && new URL(settings.APP_PUBLIC_URL).origin !== 'https://kinventoryservices.com') {
  throw new Error('La URL publica existente no coincide; revise la configuracion antes de continuar');
}
const additions = [];
if (!settings.AUTH_SECURITY_KEY) additions.push(`AUTH_SECURITY_KEY=${crypto.randomBytes(32).toString('hex')}`);
if (!settings.APP_PUBLIC_URL) additions.push('APP_PUBLIC_URL=https://kinventoryservices.com');
if (additions.length) {
  const backup = `${filename}.before-access-${Date.now()}`;
  fs.copyFileSync(filename, backup, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(backup, 0o600);
  fs.appendFileSync(filename, `${existing.endsWith('\n') ? '' : '\n'}${additions.join('\n')}\n`, 'utf8');
  fs.chmodSync(filename, 0o600);
  console.log('Configuracion preparada con respaldo privado; no se muestran ni rotan secretos existentes.');
} else {
  console.log('La configuracion ya cumple los requisitos; no se modifico.');
}