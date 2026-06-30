import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SessionUser } from './auth.js';
import { hasDatabase, query, transaction } from './db.js';
import { equipment as fallbackEquipment } from './data.js';
import { PermissionDeniedError, grantEquipmentPermission } from './permissions.js';

type TrainingRequestStatus = 'requested' | 'scheduled' | 'completed' | 'rejected';
type TrainingPurpose = 'research' | 'class' | 'other';

type TrainingRequest = {
  id: string;
  equipmentId: string;
  equipmentName: string;
  applicantUserId: string;
  applicantName: string;
  applicantEmail: string;
  applicantDepartment: string;
  requestedAt: string;
  preferredDate: string;
  preferredStart: string;
  preferredEnd: string;
  preferredNote: string;
  purpose: TrainingPurpose;
  message: string;
  status: TrainingRequestStatus;
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  scheduleChangeReason?: string;
  handledBy?: string;
  handledByName?: string;
  rejectedReason?: string;
  completedAt?: string;
};

type TrainingRequestRow = {
  id: string;
  equipmentId: string;
  equipmentName: string | null;
  managerUserId: string | null;
  applicantUserId: string;
  applicantName: string | null;
  applicantEmail: string | null;
  applicantDepartment: string | null;
  requestedAt: Date | string;
  preferredDate: string;
  preferredStart: string;
  preferredEnd: string;
  preferredNote: string;
  purpose: TrainingPurpose;
  message: string;
  status: TrainingRequestStatus;
  scheduledDate: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  scheduleChangeReason: string | null;
  handledBy: string | null;
  handledByName: string | null;
  rejectedReason: string | null;
  completedAt: Date | string | null;
};

const statusSchema = z.enum(['requested', 'scheduled', 'completed', 'rejected']);
const purposeSchema = z.enum(['research', 'class', 'other']);

const createTrainingRequestSchema = z.object({
  equipmentId: z.string().min(1),
  preferredDate: z.string().min(1),
  preferredStart: z.string().default(''),
  preferredEnd: z.string().default(''),
  preferredNote: z.string().trim().default(''),
  purpose: purposeSchema.default('research'),
  message: z.string().trim().min(1)
});

const scheduleTrainingRequestSchema = z.object({
  scheduledDate: z.string().min(1),
  scheduledStart: z.string().min(1),
  scheduledEnd: z.string().min(1),
  scheduleChangeReason: z.string().trim().default('')
}).refine((value) => value.scheduledStart < value.scheduledEnd, {
  message: 'Training end time must be after start time',
  path: ['scheduledEnd']
});

const rejectTrainingRequestSchema = z.object({
  rejectedReason: z.string().trim().min(1)
});

const fallbackTrainingRequests: TrainingRequest[] = [];

export class TrainingRequestStateError extends Error {
  constructor(message = 'Training request cannot be changed from its current status') {
    super(message);
    this.name = 'TrainingRequestStateError';
  }
}

const trainingRequestSchemaStatements = [
  `create table if not exists training_requests (
    id text primary key,
    equipment_id text not null references equipment(id) on delete restrict,
    applicant_user_id text not null references users(id) on delete cascade,
    requested_at timestamptz not null default now(),
    preferred_date text not null,
    preferred_start text not null default '',
    preferred_end text not null default '',
    preferred_note text not null default '',
    purpose text not null default 'research' check (purpose in ('research', 'class', 'other')),
    message text not null default '',
    status text not null default 'requested' check (status in ('requested', 'scheduled', 'completed', 'rejected')),
    scheduled_date text,
    scheduled_start text,
    scheduled_end text,
    schedule_change_reason text,
    handled_by text references users(id) on delete set null,
    rejected_reason text,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
  )`,
  `create index if not exists training_requests_applicant_status_idx on training_requests (applicant_user_id, status, requested_at desc) where deleted_at is null`,
  `create index if not exists training_requests_equipment_status_idx on training_requests (equipment_id, status, requested_at desc) where deleted_at is null`,
  `create index if not exists training_requests_requested_at_idx on training_requests (requested_at desc) where deleted_at is null`
];

function normalizeDate(value: Date | string | null) {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function mapTrainingRequest(row: TrainingRequestRow): TrainingRequest {
  return {
    id: row.id,
    equipmentId: row.equipmentId,
    equipmentName: row.equipmentName ?? row.equipmentId,
    applicantUserId: row.applicantUserId,
    applicantName: row.applicantName ?? '',
    applicantEmail: row.applicantEmail ?? '',
    applicantDepartment: row.applicantDepartment ?? '',
    requestedAt: normalizeDate(row.requestedAt) ?? '',
    preferredDate: row.preferredDate,
    preferredStart: row.preferredStart,
    preferredEnd: row.preferredEnd,
    preferredNote: row.preferredNote,
    purpose: row.purpose,
    message: row.message,
    status: row.status,
    ...(row.scheduledDate ? { scheduledDate: row.scheduledDate } : {}),
    ...(row.scheduledStart ? { scheduledStart: row.scheduledStart } : {}),
    ...(row.scheduledEnd ? { scheduledEnd: row.scheduledEnd } : {}),
    ...(row.scheduleChangeReason ? { scheduleChangeReason: row.scheduleChangeReason } : {}),
    ...(row.handledBy ? { handledBy: row.handledBy } : {}),
    ...(row.handledByName ? { handledByName: row.handledByName } : {}),
    ...(row.rejectedReason ? { rejectedReason: row.rejectedReason } : {}),
    ...(row.completedAt ? { completedAt: normalizeDate(row.completedAt) } : {})
  };
}

export async function ensureTrainingRequestSchema() {
  if (!hasDatabase()) return;
  for (const statement of trainingRequestSchemaStatements) {
    await query(statement);
  }
}

async function assertTrainingScope(actor: SessionUser, equipmentId: string) {
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

function filterFallbackRequests(actor: SessionUser, status?: TrainingRequestStatus) {
  return fallbackTrainingRequests.filter((request) => {
    const matchesStatus = status ? request.status === status : true;
    if (!matchesStatus) return false;
    if (actor.role === 'ADMIN' || actor.role === 'MANAGER') return true;
    return request.applicantUserId === actor.id;
  });
}

export async function listTrainingRequests(actor: SessionUser, input: unknown) {
  const querySchema = z.object({ status: statusSchema.optional() });
  const { status } = querySchema.parse(input);

  if (!hasDatabase()) return filterFallbackRequests(actor, status);

  const params: unknown[] = [];
  const where = [
    'tr.deleted_at is null',
    'e.deleted_at is null',
    'u.deleted_at is null'
  ];

  if (status) {
    params.push(status);
    where.push(`tr.status = $${params.length}`);
  }

  if (actor.role === 'MANAGER') {
    params.push(actor.id);
    where.push(`e.manager_user_id = $${params.length}`);
  }

  if (actor.role === 'USER') {
    params.push(actor.id);
    where.push(`tr.applicant_user_id = $${params.length}`);
  }

  const result = await query<TrainingRequestRow>(
    `select tr.id,
      tr.equipment_id as "equipmentId",
      e.name as "equipmentName",
      e.manager_user_id as "managerUserId",
      tr.applicant_user_id as "applicantUserId",
      u.name as "applicantName",
      u.email as "applicantEmail",
      u.department as "applicantDepartment",
      tr.requested_at as "requestedAt",
      tr.preferred_date as "preferredDate",
      tr.preferred_start as "preferredStart",
      tr.preferred_end as "preferredEnd",
      tr.preferred_note as "preferredNote",
      tr.purpose,
      tr.message,
      tr.status,
      tr.scheduled_date as "scheduledDate",
      tr.scheduled_start as "scheduledStart",
      tr.scheduled_end as "scheduledEnd",
      tr.schedule_change_reason as "scheduleChangeReason",
      tr.handled_by as "handledBy",
      handler.name as "handledByName",
      tr.rejected_reason as "rejectedReason",
      tr.completed_at as "completedAt"
     from training_requests tr
     join equipment e on e.id = tr.equipment_id
     join users u on u.id = tr.applicant_user_id
     left join users handler on handler.id = tr.handled_by
     where ${where.join(' and ')}
     order by tr.requested_at desc`,
    params
  );
  return result.rows.map(mapTrainingRequest);
}

export async function createTrainingRequest(input: unknown, actor: SessionUser) {
  const body = createTrainingRequestSchema.parse(input);
  const id = `training-${randomUUID()}`;

  if (!hasDatabase()) {
    const equipment = fallbackEquipment.find((item) => item.id === body.equipmentId);
    const request: TrainingRequest = {
      id,
      equipmentId: body.equipmentId,
      equipmentName: equipment?.name ?? body.equipmentId,
      applicantUserId: actor.id,
      applicantName: actor.name,
      applicantEmail: actor.email,
      applicantDepartment: '',
      requestedAt: new Date().toISOString(),
      preferredDate: body.preferredDate,
      preferredStart: body.preferredStart,
      preferredEnd: body.preferredEnd,
      preferredNote: body.preferredNote,
      purpose: body.purpose,
      message: body.message,
      status: 'requested'
    };
    fallbackTrainingRequests.unshift(request);
    return request;
  }

  const equipmentResult = await query<{ name: string }>(
    `select name
     from equipment
     where id = $1 and deleted_at is null`,
    [body.equipmentId]
  );
  const equipment = equipmentResult.rows[0];
  if (!equipment) {
    throw new PermissionDeniedError();
  }

  const result = await query<TrainingRequestRow>(
    `insert into training_requests (
      id, equipment_id, applicant_user_id, preferred_date, preferred_start,
      preferred_end, preferred_note, purpose, message
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    returning id,
      equipment_id as "equipmentId",
      null::text as "equipmentName",
      null::text as "managerUserId",
      applicant_user_id as "applicantUserId",
      null::text as "applicantName",
      null::text as "applicantEmail",
      null::text as "applicantDepartment",
      requested_at as "requestedAt",
      preferred_date as "preferredDate",
      preferred_start as "preferredStart",
      preferred_end as "preferredEnd",
      preferred_note as "preferredNote",
      purpose,
      message,
      status,
      scheduled_date as "scheduledDate",
      scheduled_start as "scheduledStart",
      scheduled_end as "scheduledEnd",
      schedule_change_reason as "scheduleChangeReason",
      handled_by as "handledBy",
      null::text as "handledByName",
      rejected_reason as "rejectedReason",
      completed_at as "completedAt"`,
    [
      id,
      body.equipmentId,
      actor.id,
      body.preferredDate,
      body.preferredStart,
      body.preferredEnd,
      body.preferredNote,
      body.purpose,
      body.message
    ]
  );
  return mapTrainingRequest({
    ...result.rows[0],
    equipmentName: equipment.name,
    applicantName: actor.name,
    applicantEmail: actor.email
  });
}

async function getTrainingRequest(id: string) {
  if (!hasDatabase()) return fallbackTrainingRequests.find((request) => request.id === id) ?? null;

  const result = await query<TrainingRequestRow>(
    `select tr.id,
      tr.equipment_id as "equipmentId",
      e.name as "equipmentName",
      e.manager_user_id as "managerUserId",
      tr.applicant_user_id as "applicantUserId",
      u.name as "applicantName",
      u.email as "applicantEmail",
      u.department as "applicantDepartment",
      tr.requested_at as "requestedAt",
      tr.preferred_date as "preferredDate",
      tr.preferred_start as "preferredStart",
      tr.preferred_end as "preferredEnd",
      tr.preferred_note as "preferredNote",
      tr.purpose,
      tr.message,
      tr.status,
      tr.scheduled_date as "scheduledDate",
      tr.scheduled_start as "scheduledStart",
      tr.scheduled_end as "scheduledEnd",
      tr.schedule_change_reason as "scheduleChangeReason",
      tr.handled_by as "handledBy",
      handler.name as "handledByName",
      tr.rejected_reason as "rejectedReason",
      tr.completed_at as "completedAt"
     from training_requests tr
     join equipment e on e.id = tr.equipment_id
     join users u on u.id = tr.applicant_user_id
     left join users handler on handler.id = tr.handled_by
     where tr.id = $1
       and tr.deleted_at is null
       and e.deleted_at is null
       and u.deleted_at is null`,
    [id]
  );
  return result.rows[0] ? mapTrainingRequest(result.rows[0]) : null;
}

function updateFallbackTrainingRequest(id: string, patch: Partial<TrainingRequest>) {
  const index = fallbackTrainingRequests.findIndex((request) => request.id === id);
  if (index === -1) return null;
  fallbackTrainingRequests[index] = { ...fallbackTrainingRequests[index], ...patch };
  return fallbackTrainingRequests[index];
}

function assertTrainingRequestCanBeHandled(request: TrainingRequest) {
  if (request.status !== 'requested' && request.status !== 'scheduled') {
    throw new TrainingRequestStateError();
  }
}

export async function scheduleTrainingRequest(id: string, input: unknown, actor: SessionUser) {
  const body = scheduleTrainingRequestSchema.parse(input);
  const request = await getTrainingRequest(id);
  if (!request) return null;
  await assertTrainingScope(actor, request.equipmentId);
  assertTrainingRequestCanBeHandled(request);

  if (!hasDatabase()) {
    return updateFallbackTrainingRequest(id, {
      status: 'scheduled',
      scheduledDate: body.scheduledDate,
      scheduledStart: body.scheduledStart,
      scheduledEnd: body.scheduledEnd,
      scheduleChangeReason: body.scheduleChangeReason,
      handledBy: actor.id,
      handledByName: actor.name
    });
  }

  await query(
    `update training_requests
     set status = 'scheduled',
      scheduled_date = $2,
      scheduled_start = $3,
      scheduled_end = $4,
      schedule_change_reason = $5,
      handled_by = $6,
      rejected_reason = null,
      updated_at = now()
     where id = $1 and deleted_at is null and status in ('requested', 'scheduled')`,
    [id, body.scheduledDate, body.scheduledStart, body.scheduledEnd, body.scheduleChangeReason, actor.id]
  );
  return getTrainingRequest(id);
}

export async function rejectTrainingRequest(id: string, input: unknown, actor: SessionUser) {
  const body = rejectTrainingRequestSchema.parse(input);
  const request = await getTrainingRequest(id);
  if (!request) return null;
  await assertTrainingScope(actor, request.equipmentId);
  assertTrainingRequestCanBeHandled(request);

  if (!hasDatabase()) {
    return updateFallbackTrainingRequest(id, {
      status: 'rejected',
      rejectedReason: body.rejectedReason,
      handledBy: actor.id,
      handledByName: actor.name
    });
  }

  await query(
    `update training_requests
     set status = 'rejected',
      rejected_reason = $2,
      handled_by = $3,
      updated_at = now()
     where id = $1 and deleted_at is null and status in ('requested', 'scheduled')`,
    [id, body.rejectedReason, actor.id]
  );
  return getTrainingRequest(id);
}

export async function completeTrainingRequest(id: string, actor: SessionUser) {
  const request = await getTrainingRequest(id);
  if (!request) return null;
  await assertTrainingScope(actor, request.equipmentId);
  if (request.status !== 'scheduled' && request.status !== 'completed') {
    throw new TrainingRequestStateError();
  }

  if (!hasDatabase()) {
    const completed = updateFallbackTrainingRequest(id, {
      status: 'completed',
      handledBy: actor.id,
      handledByName: actor.name,
      completedAt: new Date().toISOString()
    });
    await grantEquipmentPermission(
      { userId: request.applicantUserId, equipmentId: request.equipmentId, sourceRequestId: id },
      actor
    );
    return completed;
  }

  await transaction(async (client) => {
    const completed = await client.query(
      `update training_requests
       set status = 'completed',
        handled_by = $2,
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
       where id = $1 and deleted_at is null and status in ('scheduled', 'completed')`,
      [id, actor.id]
    );
    if (completed.rowCount === 0) {
      throw new TrainingRequestStateError();
    }

    await client.query(
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
      [
        request.applicantUserId,
        request.equipmentId,
        actor.id,
        actor.role === 'ADMIN' || actor.role === 'MANAGER' ? actor.role : 'SYSTEM',
        id
      ]
    );
    await client.query(
      `insert into equipment_permission_events (
        id, action, actor_id, actor_role, user_id, equipment_id, reason
      )
      values ($1, 'GRANT', $2, $3, $4, $5, null)`,
      [
        `permission-event-${randomUUID()}`,
        actor.id,
        actor.role === 'ADMIN' || actor.role === 'MANAGER' ? actor.role : 'SYSTEM',
        request.applicantUserId,
        request.equipmentId
      ]
    );
    await client.query(
      `update users
       set onboarding_status = 'active',
        updated_at = now()
       where id = $1 and deleted_at is null`,
      [request.applicantUserId]
    );
  });
  return getTrainingRequest(id);
}
