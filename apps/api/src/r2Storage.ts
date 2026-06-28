import { createHash, createHmac, randomUUID } from 'node:crypto';
import { z } from 'zod';

export const r2UploadSchema = z.object({
  ownerType: z.enum(['notice', 'equipment', 'qna', 'training', 'user', 'general']),
  ownerId: z.string().trim().min(1),
  purpose: z.string().trim().min(1).default('attachment'),
  fileName: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  dataBase64: z.string().min(1)
});

export type R2UploadInput = z.infer<typeof r2UploadSchema>;

const maxUploadBytes = 20 * 1024 * 1024;
const allowedContentTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

function sha256Hex(input: Buffer | string) {
  return createHash('sha256').update(input).digest('hex');
}

function hmac(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value).digest();
}

function hmacHex(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value).digest('hex');
}

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint = process.env.R2_ENDPOINT ?? (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error('R2 environment variables are not configured');
  }

  return {
    endpoint: endpoint.replace(/\/$/, ''),
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '') || ''
  };
}

function encodeStoragePath(value: string) {
  return value.split('/').map((part) => encodeURIComponent(part)).join('/');
}

function createStorageKey(input: Pick<R2UploadInput, 'ownerType' | 'ownerId' | 'fileName'>) {
  const extension = input.fileName.includes('.') ? `.${input.fileName.split('.').pop()}` : '';
  const safeOwnerId = input.ownerId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
  return `${input.ownerType}/${safeOwnerId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
}

function signR2Request(method: string, url: URL, payloadHash: string) {
  const { accessKeyId, secretAccessKey } = getR2Config();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const canonicalRequest = [
    method,
    url.pathname,
    url.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n');
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, 'auto');
  const serviceKey = hmac(regionKey, 's3');
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = hmacHex(signingKey, stringToSign);

  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate
  };
}

function toR2ObjectUrl(storageKey: string) {
  const config = getR2Config();
  return new URL(`/${config.bucketName}/${encodeStoragePath(storageKey)}`, config.endpoint);
}

export function prepareR2Upload(input: unknown) {
  const body = r2UploadSchema.parse(input);
  if (!allowedContentTypes.has(body.contentType)) {
    throw new Error('Unsupported file type');
  }

  const buffer = Buffer.from(body.dataBase64, 'base64');
  if (buffer.byteLength === 0) throw new Error('Empty file upload');
  if (buffer.byteLength > maxUploadBytes) throw new Error('File is too large');

  return {
    body,
    buffer,
    storageKey: createStorageKey(body),
    checksum: sha256Hex(buffer)
  };
}

export async function putR2Object(storageKey: string, buffer: Buffer, contentType: string) {
  const url = toR2ObjectUrl(storageKey);
  const payloadHash = sha256Hex(buffer);
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      ...signR2Request('PUT', url, payloadHash),
      'Content-Type': contentType
    },
    body: new Uint8Array(buffer)
  });

  if (!response.ok) {
    throw new Error(`R2 upload failed: ${response.status} ${await response.text()}`);
  }
}

export async function deleteR2Object(storageKey: string) {
  const url = toR2ObjectUrl(storageKey);
  const payloadHash = sha256Hex('');
  const response = await fetch(url, {
    method: 'DELETE',
    headers: signR2Request('DELETE', url, payloadHash)
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`R2 delete failed: ${response.status} ${await response.text()}`);
  }
}

export async function getR2Object(storageKey: string) {
  const url = toR2ObjectUrl(storageKey);
  const payloadHash = sha256Hex('');
  const response = await fetch(url, {
    method: 'GET',
    headers: signR2Request('GET', url, payloadHash)
  });

  if (!response.ok) {
    throw new Error(`R2 download failed: ${response.status} ${await response.text()}`);
  }

  return {
    contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    buffer: Buffer.from(await response.arrayBuffer())
  };
}

export function getR2PublicUrl(storageKey: string) {
  const { publicBaseUrl } = getR2Config();
  return publicBaseUrl ? `${publicBaseUrl}/${encodeStoragePath(storageKey)}` : undefined;
}
