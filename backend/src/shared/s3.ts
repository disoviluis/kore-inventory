import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  } : undefined
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || '';

export const getS3BucketName = (): string => BUCKET_NAME;

export const listS3Objects = async (prefix: string) => {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
    MaxKeys: 50
  });
  const response = await s3Client.send(command);
  return response.Contents || [];
};

export const createS3PresignedUploadUrl = async (key: string, contentType: string) => {
  if (!BUCKET_NAME) {
    throw new Error('AWS_S3_BUCKET no configurado');
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 900 });
};

/**
 * Crea la carpeta raíz de una empresa en S3.
 * En S3 las carpetas son objetos vacíos con key terminado en '/'.
 */
export const createS3FolderForEmpresa = async (empresaId: number): Promise<void> => {
  if (!BUCKET_NAME) return; // silenciar si no hay bucket configurado

  const folders = [
    `empresa/${empresaId}/`,
    `empresa/${empresaId}/productos/`,
    `empresa/${empresaId}/logos/`,
    `empresa/${empresaId}/pagina-publica/`
  ];

  for (const folder of folders) {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: folder,
      ContentLength: 0,
      Body: ''
    });
    await s3Client.send(command);
  }
};

/**
 * Genera URL pública de un objeto S3.
 * Si CLOUDFRONT_URL está configurado, usa el CDN en vez del S3 directo.
 */
export const getS3PublicUrl = (key: string): string => {
  const cdn = process.env.CLOUDFRONT_URL;
  if (cdn) {
    const base = cdn.replace(/\/+$/, '');
    return `${base}/${key}`;
  }
  return `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
};

export const deleteS3Object = async (key: string): Promise<void> => {
  if (!BUCKET_NAME || !key) return;
  const command = new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key });
  await s3Client.send(command);
};
