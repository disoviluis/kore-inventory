export type EvidenceType = 'activo' | 'mantenimiento' | 'repuesto' | 'inventario' | 'sesion_conteo' | 'ajuste';

export const allowedEvidenceTypes = new Set<EvidenceType>([
  'activo', 'mantenimiento', 'repuesto', 'inventario', 'sesion_conteo', 'ajuste'
]);

export const allowedEvidenceMimeTypes: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

export const matchesEvidenceFileSignature = (mime: string, bytes: Uint8Array): boolean => {
  const startsWith = (signature: number[]): boolean => signature.every((byte, index) => bytes[index] === byte);
  if (mime === 'application/pdf') return String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  if (mime === 'image/jpeg') return startsWith([0xff, 0xd8, 0xff]);
  if (mime === 'image/png') return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mime === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  return false;
};

export const isValidPrivateEvidenceKey = (
  key: string,
  companyId: number,
  type: EvidenceType,
  entityId: number,
  mime: string
): boolean => {
  const extension = allowedEvidenceMimeTypes[mime];
  if (!extension) return false;
  const prefix = `empresa/${companyId}/evidencias/${type}/${entityId}/`;
  return key.startsWith(prefix)
    && new RegExp(`^[a-f0-9-]{36}\\.${extension}$`, 'i').test(key.slice(prefix.length));
};