import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SessionUser } from './auth.js';
import { hasDatabase, query } from './db.js';

const fileAssetSchema = z.object({
  ownerType: z.enum(['notice', 'equipment', 'qna', 'training', 'user', 'general']),
  ownerId: z.string().trim().min(1),
  purpose: z.string().trim().min(1).default('attachment'),
  fileName: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  byteSize: z.number().int().min(0),
  storageProvider: z.enum(['r2', 'external']).default('r2'),
  storageKey: z.string().trim().min(1),
  publicUrl: z.string().trim().url().optional(),
  checksum: z.string().trim().optional()
});

type FileAssetInput = z.infer<typeof fileAssetSchema>;

type FileAssetRow = {
  id: string;
  ownerType: FileAssetInput['ownerType'];
  ownerId: string;
  purpose: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  storageProvider: 'r2' | 'external';
  storageKey: string;
  publicUrl: string | null;
  checksum: string | null;
  createdBy: string | null;
  createdAt: Date | string;
};

export type FileAsset = Omit<FileAssetRow, 'publicUrl' | 'checksum' | 'createdAt'> & {
  publicUrl?: string;
  checksum?: string;
  createdAt: string;
};

export const fileAssetSchemaStatements = [
  `create table if not exists file_assets (
    id text primary key,
    owner_type text not null check (owner_type in ('notice', 'equipment', 'qna', 'training', 'user', 'general')),
    owner_id text not null,
    purpose text not null default 'attachment',
    file_name text not null,
    content_type text not null,
    byte_size integer not null default 0 check (byte_size >= 0),
    storage_provider text not null default 'r2' check (storage_provider in ('r2', 'external')),
    storage_key text not null,
    public_url text,
    checksum text,
    created_by text references users(id) on delete set null,
    created_at timestamptz not null default now(),
    deleted_at timestamptz
  )`,
  `create index if not exists file_assets_owner_idx on file_assets (owner_type, owner_id, created_at desc) where deleted_at is null`,
  `create unique index if not exists file_assets_storage_key_idx on file_assets (storage_provider, storage_key) where deleted_at is null`
];

function normalizeFileAsset(row: FileAssetRow): FileAsset {
  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    purpose: row.purpose,
    fileName: row.fileName,
    contentType: row.contentType,
    byteSize: row.byteSize,
    storageProvider: row.storageProvider,
    storageKey: row.storageKey,
    createdBy: row.createdBy,
    ...(row.publicUrl ? { publicUrl: row.publicUrl } : {}),
    ...(row.checksum ? { checksum: row.checksum } : {}),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt
  };
}

export async function ensureFileAssetSchema() {
  if (!hasDatabase()) return;
  for (const statement of fileAssetSchemaStatements) {
    await query(statement);
  }
}

export async function listFileAssets(input: { ownerType?: string; ownerId?: string }) {
  if (!hasDatabase()) return [];
  const params: unknown[] = [];
  const where = ['deleted_at is null'];
  if (input.ownerType) {
    params.push(input.ownerType);
    where.push(`owner_type = $${params.length}`);
  }
  if (input.ownerId) {
    params.push(input.ownerId);
    where.push(`owner_id = $${params.length}`);
  }

  const result = await query<FileAssetRow>(
    `select
      id,
      owner_type as "ownerType",
      owner_id as "ownerId",
      purpose,
      file_name as "fileName",
      content_type as "contentType",
      byte_size as "byteSize",
      storage_provider as "storageProvider",
      storage_key as "storageKey",
      public_url as "publicUrl",
      checksum,
      created_by as "createdBy",
      created_at as "createdAt"
    from file_assets
    where ${where.join(' and ')}
    order by created_at desc
    limit 300`,
    params
  );
  return result.rows.map(normalizeFileAsset);
}

export async function createFileAsset(input: unknown, actor: SessionUser) {
  const body = fileAssetSchema.parse(input);
  const id = `file-${randomUUID()}`;
  if (!hasDatabase()) {
    return normalizeFileAsset({
      id,
      ...body,
      publicUrl: body.publicUrl ?? null,
      checksum: body.checksum ?? null,
      createdBy: actor.id,
      createdAt: new Date().toISOString()
    });
  }

  const result = await query<FileAssetRow>(
    `insert into file_assets (
      id, owner_type, owner_id, purpose, file_name, content_type, byte_size,
      storage_provider, storage_key, public_url, checksum, created_by
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    returning
      id,
      owner_type as "ownerType",
      owner_id as "ownerId",
      purpose,
      file_name as "fileName",
      content_type as "contentType",
      byte_size as "byteSize",
      storage_provider as "storageProvider",
      storage_key as "storageKey",
      public_url as "publicUrl",
      checksum,
      created_by as "createdBy",
      created_at as "createdAt"`,
    [
      id,
      body.ownerType,
      body.ownerId,
      body.purpose,
      body.fileName,
      body.contentType,
      body.byteSize,
      body.storageProvider,
      body.storageKey,
      body.publicUrl ?? null,
      body.checksum ?? null,
      actor.id
    ]
  );
  return normalizeFileAsset(result.rows[0]);
}

export async function deleteFileAsset(id: string, actor: SessionUser) {
  if (!hasDatabase()) return null;
  const result = await query<FileAssetRow>(
    `update file_assets
     set deleted_at = now()
     where id = $1 and deleted_at is null
     returning
      id,
      owner_type as "ownerType",
      owner_id as "ownerId",
      purpose,
      file_name as "fileName",
      content_type as "contentType",
      byte_size as "byteSize",
      storage_provider as "storageProvider",
      storage_key as "storageKey",
      public_url as "publicUrl",
      checksum,
      $2::text as "createdBy",
      created_at as "createdAt"`,
    [id, actor.id]
  );
  return result.rows[0] ? normalizeFileAsset(result.rows[0]) : null;
}
