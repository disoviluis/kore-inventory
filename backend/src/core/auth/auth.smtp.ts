import { isIP, BlockList } from 'net';
import { query } from '../../shared/database';
import { encryptAuthSecret, decryptAuthSecret, normalizeAuthEmail } from './auth.security';

export interface AccessSmtpConfig {
  host: string;
  port: number;
  security: 'starttls' | 'tls';
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  enabled: boolean;
  version: number;
  source: 'global' | 'servidor';
}

export function smtpMailbox(value: unknown): string | null {
  const email = normalizeAuthEmail(value);
  return email && !/[(),;<>:"\\\[\]]/.test(email) ? email : null;
}

export function validateSmtpConfig(input: any, previous?: AccessSmtpConfig | null): AccessSmtpConfig {
  const host = typeof input.host === 'string' ? input.host.trim().toLowerCase() : '';
  const port = Number(input.port);
  const security = input.security;
  const user = typeof input.user === 'string' ? input.user.trim() : '';
  const fromEmail = smtpMailbox(input.fromEmail);
  const fromName = typeof input.fromName === 'string' ? input.fromName.trim() : '';
  if (!host || host.length > 253 || isIP(host) || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Indique un servidor SMTP publico valido, por ejemplo smtp.gmail.com');
  }
  if (!Number.isInteger(port) || ![465, 587, 2525].includes(port) || !['starttls', 'tls'].includes(security) ||
      (port === 465 && security !== 'tls') || (port !== 465 && security !== 'starttls')) throw new Error('Use 465 con TLS o 587/2525 con STARTTLS');
  if (!user || user.length > 254 || /[\r\n]/.test(user) || !fromEmail || fromName.length > 100 || /[\r\n]/.test(fromName) || typeof input.enabled !== 'boolean') {
    throw new Error('Revise usuario, remitente y estado del servicio');
  }
  if (input.password !== undefined && typeof input.password !== 'string') throw new Error('Credencial no valida');
  const password = input.password || previous?.password || '';
  if (!password || password.length > 2048 || /[\r\n]/.test(password)) throw new Error('Configure una credencial SMTP valida');
  if (!input.password && previous && (host !== previous.host || user !== previous.user)) throw new Error('Al cambiar servidor o usuario debe proporcionar una nueva credencial');
  return { host, port, security, user, password, fromEmail, fromName, enabled: input.enabled,
    version: previous?.version || 0, source: 'global' };
}

export function safeSmtpConfig(config: AccessSmtpConfig | null) {
  if (!config) return { configured: false, source: 'sin_configurar', version: 0 };
  const { password, ...safe } = config;
  return { ...safe, configured: true, credentialStored: Boolean(password) };
}

export async function loadAccessSmtpConfig(): Promise<AccessSmtpConfig | null> {
  const rows = await query('SELECT * FROM auth_smtp_configuracion WHERE id = 1');
  if (rows.length) {
    const row = rows[0];
    return { host: row.host, port: row.port, security: row.seguridad, user: row.usuario,
      password: decryptAuthSecret(row.secreto_cifrado), fromEmail: row.remitente_email,
      fromName: row.remitente_nombre, enabled: Boolean(row.activo), version: Number(row.version), source: 'global' };
  }
  const env = process.env;
  if (!['AUTH_SMTP_HOST', 'AUTH_SMTP_USER', 'AUTH_SMTP_PASS', 'AUTH_MAIL_FROM'].every(key => Boolean(env[key]))) return null;
  const sender = env.AUTH_MAIL_FROM || '';
  const displayAddress = sender.match(/^([^<>]*)<([^<>]+)>$/);
  const port = Number(env.AUTH_SMTP_PORT || 587);
  const config = validateSmtpConfig({ host: env.AUTH_SMTP_HOST, port, security: port === 465 ? 'tls' : 'starttls',
    user: env.AUTH_SMTP_USER, password: env.AUTH_SMTP_PASS, fromEmail: displayAddress ? displayAddress[2] : sender,
    fromName: displayAddress ? displayAddress[1].trim() : 'Kore Inventory', enabled: true }, null);
  return { ...config, source: 'servidor' };
}

export const encryptedSmtpPassword = (config: AccessSmtpConfig) => encryptAuthSecret(config.password);

export function isPublicSmtpAddress(address: string): boolean {
  const family = isIP(address);
  const denied = new BlockList();
  for (const [network, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
    ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['192.0.2.0', 24],
    ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]] as Array<[string, number]>) {
    denied.addSubnet(network, prefix, 'ipv4');
  }
  if (family === 4) return !denied.check(address, 'ipv4');
  if (family !== 6) return false;
  const global = new BlockList(); global.addSubnet('2000::', 3, 'ipv6');
  const documentation = new BlockList(); documentation.addSubnet('2001:db8::', 32, 'ipv6');
  return global.check(address, 'ipv6') && !documentation.check(address, 'ipv6');
}