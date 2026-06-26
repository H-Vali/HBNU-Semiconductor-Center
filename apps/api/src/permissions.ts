import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SessionUser } from './auth.js';
import { hasDatabase, query } from './db.js';

type GrantMeta = {
  grantedAt: string;
  grantedByRole?: 'MANAGER' | 'ADMIN';
  sourceRequestId?: string;
};

type PermissionSnapshot = {
  permissions: Record<string, string[]>;
  grantMeta: Record<string, GrantMeta>;
  history: Array<{
    id: string;
    action: 'REVOKE';
    actorId: string;
    actorRole: 'ADMIN';
    userId: string;
    equipmentId: string;
    reason: string;
    createdAt: string;
  }>;
};

type PermissionRow = {
  userId: string;
  equipmentId: string;
  grantedAt: Date | string;
  grantedByRole: 'MANAGER' | 'ADMIN' | 'SYSTEM' | null;
  sourceRequestId: string | null;
};

type PermissionEventRow = {
  id: string;
  action: 'GRANT' | 'REVOKE';
  actorId: string | null;
  actorRole: 'MANAGER' | 'ADMIN' | 'SYSTEM';
  userId: string;
  equipmentId: string;
  reason: string | null;
  createdAt: Date | string;
};

export class PermissionDeniedError extends Error {
  constructor() {
    super('Insufficient equipment permission scope');
    this.name = 'PermissionDeniedError';
  }
}

const permissionGrantSchema = z.object({
  userId: z.string().min(1),
  equipmentId: z.string().min(1),
  sourceRequestId: z.string().min(1).optional()
});

const permissionRevokeSchema = z.object({
  userId: z.string().min(1),
  equipmentId: z.string().min(1),
  reason: z.string().trim().min(1).default('관리자 권한 회수')
});

const permissionSetSchema = z.object({
  equipmentIds: z.array(z.string().min(1)).default([])
});

const fallbackPermissions: Record<string, string[]> = {};
const fallbackGrantMeta: Record<string, GrantMeta> = {};
const fallbackHistory: PermissionSnapshot['history'] = [];

const permissionSchemaStatements = [
  `create table if not exists equipment_permissions (
    user_id text not null references users(id) on delete cascade,
    equipment_id text not null references equipment(id) on delete restrict,
    granted_at timestamptz not null default now(),
    granted_by text references users(id) on delete set null,
    granted_by_role text not null default 'SYSTEM' check (granted_by_role in ('ADMIN', 'MANAGER', 'SYSTEM')),
    source_request_id text,
    revoked_at timestamptz,
    revoked_by text references users(id) on delete set null,
    revoke_reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, equipment_id)
  )`,
  `create index if not exists equipment_permissions_user_active_idx on equipment_permissions (user_id) where revoked_at is null`,
  `create index if not exists equipment_permissions_equipment_active_idx on equipment_permissions (equipment_id) where revoked_at is null`,
  `create table if not exists equipment_permission_events (
    id text primary key,
    action text not null check (action in ('GRANT', 'REVOKE')),
    actor_id text references users(id) on delete set null,
    actor_role text not null default 'SYSTEM' check (actor_role in ('ADMIN', 'MANAGER', 'SYSTEM')),
    user_id text not null references users(id) on delete cascade,
    equipment_id text not null references equipment(id) on delete restrict,
    reason text,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists equipment_permission_events_user_idx on equipment_permission_events (user_id, created_at desc)`,
  `create index if not exists equipment_permission_events_equipment_idx on equipment_permission_events (equipment_id, created_at desc)`
];

function normalizeDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function permissionKey(userId: string, equipmentId: string) {
  return `${userId}:${equipmentId}`;
}

export async function ensureEquipmentPermissionSchema() {
  if (!hasDatabase()) return;
  for (const statement of permissionSchemaStatements) {
    await query(statement);
  }
}

function createSnapshot(rows: PermissionRow[], events: PermissionEventRow[]): PermissionSnapshot {
  const permissions: PermissionSnapshot['permissions'] = {};
  const grantMeta: PermissionSnapshot['grantMeta'] = {};

  for (const row of rows) {
    permissions[row.userId] = permissions[row.userId] ?? [];
    permissions[row.userId].push(row.equipmentId);
    grantMeta[permissionKey(row.userId, row.equipmentId)] = {
      grantedAt: normalizeDate(row.grantedAt),
      ...(row.grantedByRole === 'ADMIN' || row.grantedByRole === 'MANAGER'
        ? { grantedByRole: row.grantedByRole }
        : {}),
      ...(row.sourceRequestId ? { sourceRequestId: row.sourceRequestId } : {})
    };
  }

  return {
    permissions,
    grantMeta,
    history: events
      .filter((event) => event.action === 'REVOKE')
      .map((event) => ({
        id: event.id,
        action: 'REVOKE',
        actorId: event.actorId ?? 'system',
        actorRole: 'ADMIN',
        userId: event.userId,
        equipmentId: event.equipmentId,
        reason: event.reason ?? '',
        createdAt: normalizeDate(event.createdAt)
      }))
  };
}

function createFallbackSnapshot(): PermissionSnapshot {
  return {
    permissions: Object.fromEntries(
      Object.entries(fallbackPermissions).map(([userId, equipmentIds]) => [userId, [...equipmentIds]])
    ),
    grantMeta: { ...fallbackGrantMeta },
    history: [...fallbackHistory]
  };
}

async function assertEquipmentScope(actor: SessionUser, equipmentId: string) {
  if (actor.role === 'ADMIN' || !hasDatabase()) return;

  const result = await query<{ managerUserId: string | null }>(
    `select manager_user_id as "managerUserId"
     from equipment
     where id = $1 and deleted_at is null`,
    [equipmentId]
  );

  if (result.rows[0]?.managerUserId !== actor.id) {
    throw new PermissionDeniedError();
  }
}

async function writePermissionEvent(
  action: 'GRANT' | 'REVOKE',
  actor: SessionUser,
  userId: string,
  equipmentId: string,
  reason?: string
) {
  if (!hasDatabase()) return;
  await query(
    `insert into equipment_permission_events (
      id, action, actor_id, actor_role, user_id, equipment_id, reason
    )
    values ($1, $2, $3, $4, $5, $6, $7)`,
    [`permission-event-${randomUUID()}`, action, actor.id, actor.role, userId, equipmentId, reason ?? null]
  );
}

export async function listEquipmentPermissions() {
  if (!hasDatabase()) return createFallbackSnapshot();

  const permissions = await query<PermissionRow>(
    `select user_id as "userId",
      equipment_id as "equipmentId",
      granted_at as "grantedAt",
      granted_by_role as "grantedByRole",
      source_request_id as "sourceRequestId"
     from equipment_permissions
     where revoked_at is null
     order by granted_at asc`
  );
  const events = await query<PermissionEventRow>(
    `select id, action, actor_id as "actorId", actor_role as "actorRole",
      user_id as "userId", equipment_id as "equipmentId", reason, created_at as "createdAt"
     from equipment_permission_events
     order by created_at desc
     limit 300`
  );
  return createSnapshot(permissions.rows, events.rows);
}

export async function grantEquipmentPermission(input: unknown, actor: SessionUser) {
  const body = permissionGrantSchema.parse(input);
  await assertEquipmentScope(actor, body.equipmentId);

  if (!hasDatabase()) {
    const current = fallbackPermissions[body.userId] ?? [];
    fallbackPermissions[body.userId] = current.includes(body.equipmentId)
      ? current
      : [...current, body.equipmentId];
    fallbackGrantMeta[permissionKey(body.userId, body.equipmentId)] = {
      grantedAt: new Date().toISOString(),
      grantedByRole: actor.role === 'ADMIN' ? 'ADMIN' : 'MANAGER',
      ...(body.sourceRequestId ? { sourceRequestId: body.sourceRequestId } : {})
    };
    return createFallbackSnapshot();
  }

  await query(
    `insert into equipment_permissions (
      user_id, equipment_id, granted_at, granted_by, granted_by_role, source_request_id,
      revoked_at, revoked_by, revoke_reason
    )
    values ($1, $2, now(), $3, $4, $5, null, null, null)
    on conflict (user_id, equipment_id) do update
    set granted_at = now(),
      granted_by = excluded.granted_by,
      granted_by_role = excluded.granted_by_role,
      source_request_id = excluded.source_request_id,
      revoked_at = null,
      revoked_by = null,
      revoke_reason = null`,
    [body.userId, body.equipmentId, actor.id, actor.role, body.sourceRequestId ?? null]
  );
  await writePermissionEvent('GRANT', actor, body.userId, body.equipmentId);
  return listEquipmentPermissions();
}

export async function revokeEquipmentPermission(input: unknown, actor: SessionUser) {
  const body = permissionRevokeSchema.parse(input);

  if (!hasDatabase()) {
    fallbackPermissions[body.userId] = (fallbackPermissions[body.userId] ?? []).filter(
      (equipmentId) => equipmentId !== body.equipmentId
    );
    delete fallbackGrantMeta[permissionKey(body.userId, body.equipmentId)];
    fallbackHistory.unshift({
      id: `permission-history-${Date.now()}`,
      action: 'REVOKE',
      actorId: actor.id,
      actorRole: 'ADMIN',
      userId: body.userId,
      equipmentId: body.equipmentId,
      reason: body.reason,
      createdAt: new Date().toISOString()
    });
    return createFallbackSnapshot();
  }

  await query(
    `update equipment_permissions
     set revoked_at = now(),
      revoked_by = $3,
      revoke_reason = $4
     where user_id = $1 and equipment_id = $2 and revoked_at is null`,
    [body.userId, body.equipmentId, actor.id, body.reason]
  );
  await writePermissionEvent('REVOKE', actor, body.userId, body.equipmentId, body.reason);
  return listEquipmentPermissions();
}

export async function setUserEquipmentPermissions(userId: string, input: unknown, actor: SessionUser) {
  const body = permissionSetSchema.parse(input);
  const equipmentIds = Array.from(new Set(body.equipmentIds));

  const current = await listEquipmentPermissions();
  const currentEquipmentIds = current.permissions[userId] ?? [];
  const toGrant = equipmentIds.filter((equipmentId) => !currentEquipmentIds.includes(equipmentId));
  const toRevoke = currentEquipmentIds.filter((equipmentId) => !equipmentIds.includes(equipmentId));

  for (const equipmentId of toGrant) {
    await grantEquipmentPermission({ userId, equipmentId }, actor);
  }
  for (const equipmentId of toRevoke) {
    await revokeEquipmentPermission({ userId, equipmentId, reason: '관리자 권한 일괄 수정' }, actor);
  }

  return listEquipmentPermissions();
}
