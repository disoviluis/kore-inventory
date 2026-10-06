import crypto from 'crypto';
import { authenticator } from 'otplib';

export const getAuthSecret = (): string => {
  const secret = process.env.JWT_SECRET || '';
  if (Buffer.byteLength(secret, 'utf8') < 32 || secret === 'secret_key_default') {
    throw new Error('JWT_SECRET debe tener al menos 32 bytes y no usar un valor predeterminado');
  }
  return secret;
};

export function getAuthSecurityKey(): string {
  const key = process.env.AUTH_SECURITY_KEY || (process.env.NODE_ENV !== 'production' ? getAuthSecret() : '');
  if (Buffer.byteLength(key, 'utf8') < 32 || key.startsWith('CLAVE_ALEATORIA_')) throw new Error('AUTH_SECURITY_KEY debe ser una clave privada real de al menos 32 bytes');
  return key;
}

export const protectAuthValue = (value: string): string =>
  crypto.createHmac('sha256', getAuthSecurityKey()).update(value).digest('hex');

const commonPasswords = new Set(['123456789012345', '1234567890123456', 'passwordpassword', 'password123456789', 'qwertyuiopasdfgh', 'contrase\u00f1acontrase\u00f1a']);
export const validAuthPassword = (value: unknown): value is string =>
  typeof value === 'string' && value.length >= 15 && Buffer.byteLength(value, 'utf8') <= 72 &&
  !commonPasswords.has(value.toLowerCase()) && !/^(.)\1+$/.test(value);

export const normalizeAuthEmail = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

export function encryptAuthSecret(value: string): string {
  const key = crypto.createHash('sha256').update(getAuthSecurityKey()).digest();
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [nonce, cipher.getAuthTag(), encrypted].map(part => part.toString('base64')).join('.');
}

export function decryptAuthSecret(value: string): string {
  const [nonce, tag, encrypted] = value.split('.').map(part => Buffer.from(part, 'base64'));
  const key = crypto.createHash('sha256').update(getAuthSecurityKey()).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function validMfaCode(code: unknown, encryptedSecret: string, lastStep: number | null): boolean {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return false;
  const step = Math.floor(Date.now() / 30000);
  return step > Number(lastStep || 0) && authenticator.check(code, decryptAuthSecret(encryptedSecret));
}