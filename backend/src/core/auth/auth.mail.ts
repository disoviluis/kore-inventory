import nodemailer from 'nodemailer';
import { lookup } from 'dns/promises';
import { AccessSmtpConfig, loadAccessSmtpConfig, isPublicSmtpAddress, smtpMailbox } from './auth.smtp';

export function authPublicUrl(): string {
  const url = new URL(process.env.APP_PUBLIC_URL || 'https://kinventoryservices.com');
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('APP_PUBLIC_URL debe usar HTTPS');
  return url.origin;
}

export async function authMailConfigured(): Promise<boolean> {
  const config = await loadAccessSmtpConfig();
  return Boolean(config?.enabled);
}

export async function sendAuthMail(to: string, subject: string, text: string, selectedConfig?: AccessSmtpConfig) {
  const config = selectedConfig || await loadAccessSmtpConfig();
  if (!config?.enabled) throw Object.assign(new Error('El correo de acceso aun no esta configurado o esta desactivado'), { status: 503 });
  const recipient = smtpMailbox(to);
  if (!recipient) throw new Error('Destinatario no valido');
  const addresses = await lookup(config.host, { all: true });
  if (!addresses.length || addresses.some(entry => !isPublicSmtpAddress(entry.address))) throw new Error('El servidor SMTP debe resolver solo a direcciones publicas');
  const target = addresses.find(entry => entry.family === 4) || addresses[0];
  const transport = nodemailer.createTransport({
    host: target.address, port: config.port, secure: config.security === 'tls', requireTLS: true,
    tls: { servername: config.host, rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    disableFileAccess: true, disableUrlAccess: true
  });
  try { await transport.sendMail({ from: { name: config.fromName, address: config.fromEmail }, to: recipient, subject, text }); }
  finally { transport.close(); }
}