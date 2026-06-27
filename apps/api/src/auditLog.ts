import { randomUUID } from 'node:crypto';
import type { SessionUser } from './auth.js';
import { hasDatabase, query } from './db.js';

export const auditLogSchemaStatements = [
  `create table if not exists audit_logs (
    id text primary key,
    actor_id text references users(id) on delete set null,
    actor_email text,
    actor_role text not null default 'SYSTEM',
    action text not null,
    entity_type text not null,
    entity_id text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists audit_logs_entity_idx on audit_logs (entity_type, entity_id, created_at desc)`,
  `create index if not exists audit_logs_actor_idx on audit_logs (actor_id, created_at desc)`
];

export async function ensureAuditLogSchema() {
  if (!hasDatabase()) return;
  for (const statement of auditLogSchemaStatements) {
    await query(statement);
  }
}

export async function writeAuditLog(
  actor: SessionUser | null,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {}
) {
  if (!hasDatabase()) return;

  await query(
    `insert into audit_logs (
      id, actor_id, actor_email, actor_role, action, entity_type, entity_id, metadata
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      `audit-${randomUUID()}`,
      actor?.id ?? null,
      actor?.email ?? null,
      actor?.role ?? 'SYSTEM',
      action,
      entityType,
      entityId,
      JSON.stringify(metadata)
    ]
  );
}

export type AuditLogEntry = {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type AuditLogRow = Omit<AuditLogEntry, 'createdAt'> & {
  createdAt: Date | string;
};

export async function listAuditLogs(limit = 200): Promise<AuditLogEntry[]> {
  if (!hasDatabase()) return [];
  const normalizedLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const result = await query<AuditLogRow>(
    `select
      id,
      actor_id as "actorId",
      actor_email as "actorEmail",
      actor_role as "actorRole",
      action,
      entity_type as "entityType",
      entity_id as "entityId",
      metadata,
      created_at as "createdAt"
    from audit_logs
    order by created_at desc
    limit $1`,
    [normalizedLimit]
  );
  return result.rows.map((row) => ({
    ...row,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt
  }));
}
