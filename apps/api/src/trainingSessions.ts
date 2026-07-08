import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SessionUser } from './auth.js';
import { equipment as fallbackEquipment } from './data.js';
import { hasDatabase, query, transaction } from './db.js';
import { PermissionDeniedError } from './permissions.js';

type TrainingSessionStatus = 'OPEN' | 'FULL' | 'CLOSED' | 'CANCELED' | 'DONE';
type SessionRegistrationStatus = 'REGISTERED' | 'CANCELED' | 'COMPLETED' | 'NO_SHOW';
type PenaltyCandidateStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

type TrainingSessionRow = {
  id: string;
  equipmentId: string;
  equipmentName: string | null;
  category: string | null;
  groupName: string | null;
  managerId: string | null;
  managerName: string | null;
  applyDeadline: Date | string;
  capacity: number;
  note: string;
  status: TrainingSessionStatus;
  registeredCount: string | number;
  completedCount: string | number;
  noShowCount: string | number;
  createdAt: Date | string;
};

type SessionRegistrationRow = {
  id: string;
  sessionId: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userPhone: string | null;
  userDepartment: string | null;
  status: SessionRegistrationStatus;
  registeredAt: Date | string;
  canceledAt: Date | string | null;
  completedAt: Date | string | null;
  noShowAt: Date | string | null;
};

type PenaltyCandidateRow = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userDepartment: string | null;
  equipmentId: string;
  equipmentName: string | null;
  sessionId: string;
  registrationId: string;
  managerId: string | null;
  managerName: string | null;
  applyDeadline: Date | string;
  origin: 'NO_SHOW';
  status: PenaltyCandidateStatus;
  reason: string | null;
  reviewReason: string | null;
  createdAt: Date | string;
  reviewedAt: Date | string | null;
};

type MyTrainingRegistrationRow = {
  registrationId: string;
  sessionId: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userPhone: string | null;
  userDepartment: string | null;
  registrationStatus: SessionRegistrationStatus;
  registeredAt: Date | string;
  canceledAt: Date | string | null;
  completedAt: Date | string | null;
  noShowAt: Date | string | null;
  equipmentId: string;
  equipmentName: string | null;
  category: string | null;
  groupName: string | null;
  managerId: string | null;
  managerName: string | null;
  applyDeadline: Date | string;
  capacity: number;
  note: string;
  sessionStatus: TrainingSessionStatus;
  createdAt: Date | string;
  registeredCount: string | number;
  completedCount: string | number;
  noShowCount: string | number;
};

type TrainingSession = ReturnType<typeof mapTrainingSession>;
type SessionRegistration = ReturnType<typeof mapSessionRegistration>;

const SESSION_CAPACITY = 3;

const createSessionSchema = z.object({
  equipmentId: z.string().min(1),
  applyDeadline: z.string().min(1),
  note: z.string().trim().default('')
});

const updateSessionSchema = z.object({
  applyDeadline: z.string().min(1),
  note: z.string().trim().default('')
});

const listSessionSchema = z.object({
  scope: z.enum(['all', 'manager', 'open']).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  status: z.enum(['OPEN', 'FULL', 'CLOSED', 'CANCELED', 'DONE']).optional(),
  equipmentId: z.string().min(1).optional(),
  managerId: z.string().min(1).optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1)
});

const userIdsSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1),
  reason: z.string().trim().optional()
});

const candidateStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'REJECTED']).default('PENDING')
});

const confirmCandidateSchema = z.object({
  type: z.string().trim().min(1).default('6개월 사용정지'),
  category: z.string().trim().min(1).default('장비활용관련'),
  reason: z.string().trim().optional(),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional()
});

const rejectCandidateSchema = z.object({
  reason: z.string().trim().min(1)
});

function addMonths(value: string, months: number) {
  const date = new Date(value);
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

const fallbackSessions: TrainingSession[] = [];
const fallbackRegistrations: SessionRegistration[] = [];
const fallbackPenaltyCandidates: ReturnType<typeof mapPenaltyCandidate>[] = [];

export class TrainingSessionStateError extends Error {
  constructor(message = 'Training session cannot be changed from its current state') {
    super(message);
    this.name = 'TrainingSessionStateError';
  }
}

export class TrainingSeatUnavailableError extends Error {
  constructor(message = 'Training session has no available seats') {
    super(message);
    this.name = 'TrainingSeatUnavailableError';
  }
}

const trainingSessionSchemaStatements = [
  `create table if not exists training_session (
    id text primary key,
    equipment_id text not null references equipment(id) on delete restrict,
    manager_id text references users(id) on delete set null,
    apply_deadline timestamptz not null,
    capacity integer not null default 3 check (capacity = 3),
    note text not null default '',
    status text not null default 'OPEN' check (status in ('OPEN', 'FULL', 'CLOSED', 'CANCELED', 'DONE')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
  )`,
  `create index if not exists training_session_deadline_idx on training_session (apply_deadline desc) where deleted_at is null`,
  `create index if not exists training_session_equipment_idx on training_session (equipment_id, apply_deadline desc) where deleted_at is null`,
  `create table if not exists session_registration (
    id text primary key,
    session_id text not null references training_session(id) on delete cascade,
    user_id text not null references users(id) on delete cascade,
    status text not null default 'REGISTERED' check (status in ('REGISTERED', 'CANCELED', 'COMPLETED', 'NO_SHOW')),
    registered_at timestamptz not null default now(),
    canceled_at timestamptz,
    completed_at timestamptz,
    no_show_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (session_id, user_id)
  )`,
  `create index if not exists session_registration_session_status_idx on session_registration (session_id, status)`,
  `create index if not exists session_registration_user_idx on session_registration (user_id, registered_at desc)`,
  `create table if not exists penalty_candidate (
    id text primary key,
    user_id text not null references users(id) on delete cascade,
    equipment_id text not null references equipment(id) on delete restrict,
    session_id text not null references training_session(id) on delete cascade,
    registration_id text not null references session_registration(id) on delete cascade,
    origin text not null default 'NO_SHOW' check (origin in ('NO_SHOW')),
    status text not null default 'PENDING' check (status in ('PENDING', 'CONFIRMED', 'REJECTED')),
    created_by text references users(id) on delete set null,
    reviewed_by text references users(id) on delete set null,
    reason text,
    review_reason text,
    created_at timestamptz not null default now(),
    reviewed_at timestamptz,
    unique (registration_id)
  )`,
  `create index if not exists penalty_candidate_status_idx on penalty_candidate (status, created_at desc)`
];

export async function ensureTrainingSessionSchema() {
  if (!hasDatabase()) return;
  for (const statement of trainingSessionSchemaStatements) {
    await query(statement);
  }
}

function normalizeDate(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function deriveStoredStatus(status: TrainingSessionStatus, applyDeadline: string) {
  if ((status === 'OPEN' || status === 'FULL') && new Date(applyDeadline).getTime() <= Date.now()) {
    return 'CLOSED' as const;
  }
  return status;
}

function mapTrainingSession(row: TrainingSessionRow) {
  const applyDeadline = normalizeDate(row.applyDeadline) ?? '';
  const status = deriveStoredStatus(row.status, applyDeadline);
  return {
    id: row.id,
    equipmentId: row.equipmentId,
    equipmentName: row.equipmentName ?? row.equipmentId,
    category: row.category ?? '',
    groupName: row.groupName ?? '',
    managerId: row.managerId ?? '',
    managerName: row.managerName ?? '담당자 미지정',
    applyDeadline,
    capacity: Number(row.capacity || SESSION_CAPACITY),
    note: row.note,
    status,
    registeredCount: Number(row.registeredCount || 0),
    completedCount: Number(row.completedCount || 0),
    noShowCount: Number(row.noShowCount || 0),
    createdAt: normalizeDate(row.createdAt) ?? ''
  };
}

function mapSessionRegistration(row: SessionRegistrationRow, includeContact = true) {
  return {
    id: row.id,
    sessionId: row.sessionId,
    userId: row.userId,
    userName: row.userName ?? row.userId,
    userDepartment: row.userDepartment ?? '',
    ...(includeContact ? {
      userEmail: row.userEmail ?? '',
      userPhone: row.userPhone ?? ''
    } : {}),
    status: row.status,
    registeredAt: normalizeDate(row.registeredAt) ?? '',
    canceledAt: normalizeDate(row.canceledAt),
    completedAt: normalizeDate(row.completedAt),
    noShowAt: normalizeDate(row.noShowAt)
  };
}

function mapPenaltyCandidate(row: PenaltyCandidateRow) {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.userName ?? row.userId,
    userEmail: row.userEmail ?? '',
    userDepartment: row.userDepartment ?? '',
    equipmentId: row.equipmentId,
    equipmentName: row.equipmentName ?? row.equipmentId,
    sessionId: row.sessionId,
    registrationId: row.registrationId,
    managerId: row.managerId ?? '',
    managerName: row.managerName ?? '담당자 미지정',
    applyDeadline: normalizeDate(row.applyDeadline) ?? '',
    origin: row.origin,
    status: row.status,
    reason: row.reason ?? '',
    reviewReason: row.reviewReason ?? '',
    createdAt: normalizeDate(row.createdAt) ?? '',
    reviewedAt: normalizeDate(row.reviewedAt)
  };
}

function parseDeadline(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T23:59:59+09:00`
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
      ? `${value}:00+09:00`
      : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new TrainingSessionStateError('Invalid apply deadline');
  return date.toISOString();
}

function monthRange(month?: string) {
  if (!month) return null;
  const start = new Date(`${month}-01T00:00:00+09:00`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function assertManagerScope(actor: SessionUser, equipmentId: string) {
  if (actor.role === 'ADMIN' || !hasDatabase()) return;
  const result = await query<{ managerUserId: string | null }>(
    `select manager_user_id as "managerUserId"
     from equipment
     where id = $1 and deleted_at is null`,
    [equipmentId]
  );
  if (result.rows[0]?.managerUserId !== actor.id) throw new PermissionDeniedError();
}

function getSessionSelect(whereSql: string) {
  return `select ts.id,
      ts.equipment_id as "equipmentId",
      e.name as "equipmentName",
      e.category,
      e.group_name as "groupName",
      ts.manager_id as "managerId",
      manager.name as "managerName",
      ts.apply_deadline as "applyDeadline",
      ts.capacity,
      ts.note,
      ts.status,
      ts.created_at as "createdAt",
      count(sr.id) filter (where sr.status = 'REGISTERED') as "registeredCount",
      count(sr.id) filter (where sr.status = 'COMPLETED') as "completedCount",
      count(sr.id) filter (where sr.status = 'NO_SHOW') as "noShowCount"
    from training_session ts
    join equipment e on e.id = ts.equipment_id and e.deleted_at is null
    left join users manager on manager.id = ts.manager_id and manager.deleted_at is null
    left join session_registration sr on sr.session_id = ts.id
    where ${whereSql}
    group by ts.id, e.id, manager.id`;
}

async function getSession(id: string) {
  const result = await query<TrainingSessionRow>(
    `${getSessionSelect('ts.id = $1 and ts.deleted_at is null')}
     limit 1`,
    [id]
  );
  return result.rows[0] ? mapTrainingSession(result.rows[0]) : null;
}

async function listRegistrationsForSession(sessionId: string, includeContact: boolean) {
  if (!hasDatabase()) {
    return fallbackRegistrations
      .filter((registration) => registration.sessionId === sessionId)
      .map((registration) => includeContact ? registration : {
        ...registration,
        userEmail: undefined,
        userPhone: undefined
      });
  }

  const result = await query<SessionRegistrationRow>(
    `select sr.id,
      sr.session_id as "sessionId",
      sr.user_id as "userId",
      u.name as "userName",
      u.email as "userEmail",
      u.phone as "userPhone",
      u.department as "userDepartment",
      sr.status,
      sr.registered_at as "registeredAt",
      sr.canceled_at as "canceledAt",
      sr.completed_at as "completedAt",
      sr.no_show_at as "noShowAt"
     from session_registration sr
     join users u on u.id = sr.user_id and u.deleted_at is null
     where sr.session_id = $1
     order by sr.registered_at asc`,
    [sessionId]
  );
  return result.rows.map((row) => mapSessionRegistration(row, includeContact));
}

async function getSessionDetail(id: string, actor: SessionUser) {
  const session = await getSession(id);
  if (!session) return null;
  const canSeeContacts = actor.role === 'ADMIN' || (actor.role === 'MANAGER' && session.managerId === actor.id);
  const registrations = await listRegistrationsForSession(id, canSeeContacts);
  const myRegistration = registrations.find((registration) => registration.userId === actor.id) ?? null;
  return { ...session, registrations: canSeeContacts ? registrations : undefined, myRegistration };
}

function createSummary(items: TrainingSession[]) {
  const totalCapacity = items.reduce((sum, item) => sum + item.capacity, 0);
  const registered = items.reduce((sum, item) => sum + item.registeredCount, 0);
  return {
    total: items.length,
    open: items.filter((item) => item.status === 'OPEN').length,
    registered,
    averageFillRate: totalCapacity ? Math.round((registered / totalCapacity) * 100) : 0
  };
}

export async function listTrainingSessions(actor: SessionUser, input: unknown) {
  const body = listSessionSchema.parse(input);
  const requestedScope = body.scope;
  const scope = actor.role === 'ADMIN'
    ? requestedScope ?? 'all'
    : requestedScope === 'manager' && actor.role === 'MANAGER'
      ? 'manager'
      : requestedScope === 'open'
        ? 'open'
        : 'all';

  if (!hasDatabase()) {
    let items = [...fallbackSessions];
    if (scope === 'open') {
      items = items.filter((item) => (item.status === 'OPEN' || item.status === 'FULL') && new Date(item.applyDeadline).getTime() > Date.now());
    }
    if (scope === 'manager') items = items.filter((item) => item.managerId === actor.id);
    return { items, summary: createSummary(items), page: 1, pageSize: 50, total: items.length };
  }

  const params: unknown[] = [];
  const where = ['ts.deleted_at is null'];

  if (scope === 'manager') {
    params.push(actor.id);
    where.push(`ts.manager_id = $${params.length}`);
  }
  if (scope === 'open') {
    where.push(`ts.status in ('OPEN', 'FULL') and ts.apply_deadline > now()`);
  }
  const range = monthRange(body.month);
  if (range) {
    params.push(range.start);
    where.push(`ts.apply_deadline >= $${params.length}`);
    params.push(range.end);
    where.push(`ts.apply_deadline < $${params.length}`);
  }
  if (body.equipmentId) {
    params.push(body.equipmentId);
    where.push(`ts.equipment_id = $${params.length}`);
  }
  if (body.managerId && actor.role === 'ADMIN') {
    params.push(body.managerId);
    where.push(`ts.manager_id = $${params.length}`);
  }
  if (body.q) {
    params.push(`%${body.q}%`);
    where.push(`(e.name ilike $${params.length} or e.category ilike $${params.length} or coalesce(manager.name, '') ilike $${params.length})`);
  }

  const result = await query<TrainingSessionRow>(
    `${getSessionSelect(where.join(' and '))}
     order by ts.apply_deadline desc`,
    params
  );
  let items = result.rows.map(mapTrainingSession);
  if (body.status) items = items.filter((item) => item.status === body.status);
  const pageSize = 50;
  const page = body.page;
  const paged = items.slice((page - 1) * pageSize, page * pageSize);
  return { items: paged, summary: createSummary(items), page, pageSize, total: items.length };
}

export async function listMyTrainingRegistrations(actor: SessionUser) {
  if (!hasDatabase()) {
    return fallbackRegistrations
      .filter((registration) => registration.userId === actor.id)
      .map((registration) => ({
        ...registration,
        session: fallbackSessions.find((session) => session.id === registration.sessionId) ?? null
      }));
  }

  const result = await query<MyTrainingRegistrationRow>(
    `select sr.id as "registrationId",
      sr.session_id as "sessionId",
      sr.user_id as "userId",
      u.name as "userName",
      u.email as "userEmail",
      u.phone as "userPhone",
      u.department as "userDepartment",
      sr.status as "registrationStatus",
      sr.registered_at as "registeredAt",
      sr.canceled_at as "canceledAt",
      sr.completed_at as "completedAt",
      sr.no_show_at as "noShowAt",
      ts.equipment_id as "equipmentId",
      e.name as "equipmentName",
      e.category,
      e.group_name as "groupName",
      ts.manager_id as "managerId",
      manager.name as "managerName",
      ts.apply_deadline as "applyDeadline",
      ts.capacity,
      ts.note,
      ts.status as "sessionStatus",
      ts.created_at as "createdAt",
      (select count(*) from session_registration active_sr where active_sr.session_id = ts.id and active_sr.status = 'REGISTERED') as "registeredCount",
      (select count(*) from session_registration completed_sr where completed_sr.session_id = ts.id and completed_sr.status = 'COMPLETED') as "completedCount",
      (select count(*) from session_registration noshow_sr where noshow_sr.session_id = ts.id and noshow_sr.status = 'NO_SHOW') as "noShowCount"
     from session_registration sr
     join training_session ts on ts.id = sr.session_id and ts.deleted_at is null
     join equipment e on e.id = ts.equipment_id and e.deleted_at is null
     join users u on u.id = sr.user_id and u.deleted_at is null
     left join users manager on manager.id = ts.manager_id and manager.deleted_at is null
     where sr.user_id = $1
     order by sr.registered_at desc`,
    [actor.id]
  );

  return result.rows.map((row) => ({
    ...mapSessionRegistration({
      id: row.registrationId,
      sessionId: row.sessionId,
      userId: row.userId,
      userName: row.userName,
      userEmail: row.userEmail,
      userPhone: row.userPhone,
      userDepartment: row.userDepartment,
      status: row.registrationStatus,
      registeredAt: row.registeredAt,
      canceledAt: row.canceledAt,
      completedAt: row.completedAt,
      noShowAt: row.noShowAt
    }, false),
    session: mapTrainingSession({
      id: row.sessionId,
      equipmentId: row.equipmentId,
      equipmentName: row.equipmentName,
      category: row.category,
      groupName: row.groupName,
      managerId: row.managerId,
      managerName: row.managerName,
      applyDeadline: row.applyDeadline,
      capacity: row.capacity,
      note: row.note,
      status: row.sessionStatus,
      registeredCount: row.registeredCount,
      completedCount: row.completedCount,
      noShowCount: row.noShowCount,
      createdAt: row.createdAt
    })
  }));
}

export async function getTrainingSessionDetail(id: string, actor: SessionUser) {
  if (!hasDatabase()) {
    const session = fallbackSessions.find((item) => item.id === id);
    if (!session) return null;
    const registrations = fallbackRegistrations.filter((item) => item.sessionId === id);
    return {
      ...session,
      registrations: actor.role === 'ADMIN' || session.managerId === actor.id ? registrations : undefined,
      myRegistration: registrations.find((item) => item.userId === actor.id) ?? null
    };
  }
  return getSessionDetail(id, actor);
}

export async function createTrainingSession(input: unknown, actor: SessionUser) {
  const body = createSessionSchema.parse(input);
  const applyDeadline = parseDeadline(body.applyDeadline);
  if (new Date(applyDeadline).getTime() <= Date.now()) {
    throw new TrainingSessionStateError('Apply deadline must be in the future');
  }
  await assertManagerScope(actor, body.equipmentId);
  const id = `training-session-${randomUUID()}`;

  if (!hasDatabase()) {
    const equipment = fallbackEquipment.find((item) => item.id === body.equipmentId);
    const session = {
      id,
      equipmentId: body.equipmentId,
      equipmentName: equipment?.name ?? body.equipmentId,
      category: equipment?.category ?? '',
      groupName: equipment?.groupName ?? '',
      managerId: actor.id,
      managerName: actor.name,
      applyDeadline,
      capacity: SESSION_CAPACITY,
      note: body.note,
      status: 'OPEN' as const,
      registeredCount: 0,
      completedCount: 0,
      noShowCount: 0,
      createdAt: new Date().toISOString()
    };
    fallbackSessions.unshift(session);
    return session;
  }

  await query(
    `insert into training_session (id, equipment_id, manager_id, apply_deadline, capacity, note, status)
     values ($1, $2, $3, $4, 3, $5, 'OPEN')`,
    [id, body.equipmentId, actor.id, applyDeadline, body.note]
  );
  return getSessionDetail(id, actor);
}

export async function updateTrainingSession(id: string, input: unknown, actor: SessionUser) {
  const body = updateSessionSchema.parse(input);
  const applyDeadline = parseDeadline(body.applyDeadline);
  if (new Date(applyDeadline).getTime() <= Date.now()) {
    throw new TrainingSessionStateError('Apply deadline must be in the future');
  }

  if (!hasDatabase()) {
    const index = fallbackSessions.findIndex((item) => item.id === id);
    if (index === -1) throw new TrainingSessionStateError('Training session not found');
    const session = fallbackSessions[index];
    if (actor.role !== 'ADMIN' && session.managerId !== actor.id) throw new PermissionDeniedError();
    if (session.status === 'CANCELED' || session.status === 'DONE') {
      throw new TrainingSessionStateError('Training session cannot be updated');
    }
    const activeRegistrations = fallbackRegistrations.filter((registration) => (
      registration.sessionId === id && registration.status === 'REGISTERED'
    ));
    fallbackSessions[index] = {
      ...session,
      applyDeadline,
      note: body.note,
      status: activeRegistrations.length >= session.capacity ? 'FULL' : 'OPEN'
    };
    return getTrainingSessionDetail(id, actor);
  }

  await transaction(async (client) => {
    const sessionResult = await client.query<{
      managerId: string | null;
      capacity: number;
      status: TrainingSessionStatus;
    }>(
      `select manager_id as "managerId", capacity, status
       from training_session
       where id = $1 and deleted_at is null
       for update`,
      [id]
    );
    const session = sessionResult.rows[0];
    if (!session) throw new TrainingSessionStateError('Training session not found');
    if (actor.role !== 'ADMIN' && session.managerId !== actor.id) throw new PermissionDeniedError();
    if (session.status === 'CANCELED' || session.status === 'DONE') {
      throw new TrainingSessionStateError('Training session cannot be updated');
    }
    const countResult = await client.query<{ count: string }>(
      `select count(*)::int as count
       from session_registration
       where session_id = $1 and status = 'REGISTERED'`,
      [id]
    );
    const registeredCount = Number(countResult.rows[0]?.count ?? 0);
    await client.query(
      `update training_session
       set apply_deadline = $2, note = $3, status = $4, updated_at = now()
       where id = $1 and deleted_at is null`,
      [id, applyDeadline, body.note, registeredCount >= session.capacity ? 'FULL' : 'OPEN']
    );
  });
  return getTrainingSessionDetail(id, actor);
}

export async function deleteTrainingSession(id: string, actor: SessionUser) {
  if (!hasDatabase()) {
    const index = fallbackSessions.findIndex((item) => item.id === id);
    if (index === -1) throw new TrainingSessionStateError('Training session not found');
    const session = fallbackSessions[index];
    if (actor.role !== 'ADMIN' && session.managerId !== actor.id) throw new PermissionDeniedError();
    if (session.status === 'DONE' && actor.role !== 'ADMIN') throw new TrainingSessionStateError('Completed training session cannot be deleted');
    fallbackSessions.splice(index, 1);
    for (let i = fallbackRegistrations.length - 1; i >= 0; i -= 1) {
      if (fallbackRegistrations[i].sessionId === id) fallbackRegistrations.splice(i, 1);
    }
    return { id, deleted: true };
  }

  await transaction(async (client) => {
    const sessionResult = await client.query<{
      managerId: string | null;
      status: TrainingSessionStatus;
    }>(
      `select manager_id as "managerId", status
       from training_session
       where id = $1 and deleted_at is null
       for update`,
      [id]
    );
    const session = sessionResult.rows[0];
    if (!session) throw new TrainingSessionStateError('Training session not found');
    if (actor.role !== 'ADMIN' && session.managerId !== actor.id) throw new PermissionDeniedError();
    if (session.status === 'DONE' && actor.role !== 'ADMIN') throw new TrainingSessionStateError('Completed training session cannot be deleted');
    await client.query(`delete from session_registration where session_id = $1`, [id]);
    await client.query(
      `update training_session
       set status = 'CANCELED', deleted_at = now(), updated_at = now()
       where id = $1 and deleted_at is null`,
      [id]
    );
  });
  return { id, deleted: true };
}

export async function registerTrainingSession(id: string, actor: SessionUser) {
  if (actor.role === 'ADMIN') throw new PermissionDeniedError();
  if (!hasDatabase()) throw new TrainingSessionStateError('Training registration requires database storage');

  await transaction(async (client) => {
    const sessionResult = await client.query<{
      equipmentId: string;
      applyDeadline: Date | string;
      capacity: number;
      status: TrainingSessionStatus;
    }>(
      `select equipment_id as "equipmentId", apply_deadline as "applyDeadline", capacity, status
       from training_session
       where id = $1 and deleted_at is null
       for update`,
      [id]
    );
    const session = sessionResult.rows[0];
    if (!session) throw new TrainingSessionStateError('Training session not found');
    const deadline = new Date(normalizeDate(session.applyDeadline) ?? '');
    if (session.status === 'CANCELED' || session.status === 'DONE' || deadline.getTime() <= Date.now()) {
      throw new TrainingSessionStateError('Training session is closed');
    }
    const countResult = await client.query<{ count: string }>(
      `select count(*)::int as count
       from session_registration
       where session_id = $1 and status = 'REGISTERED'`,
      [id]
    );
    const registeredCount = Number(countResult.rows[0]?.count ?? 0);
    if (registeredCount >= session.capacity) throw new TrainingSeatUnavailableError();

    const existing = await client.query<{ id: string; status: SessionRegistrationStatus }>(
      `select id, status
       from session_registration
       where session_id = $1 and user_id = $2
       for update`,
      [id, actor.id]
    );
    const registration = existing.rows[0];
    if (registration && registration.status !== 'CANCELED') {
      throw new TrainingSessionStateError('Already registered for this training session');
    }
    if (registration) {
      await client.query(
        `update session_registration
         set status = 'REGISTERED', registered_at = now(), canceled_at = null, updated_at = now()
         where id = $1`,
        [registration.id]
      );
    } else {
      await client.query(
        `insert into session_registration (id, session_id, user_id, status)
         values ($1, $2, $3, 'REGISTERED')`,
        [`session-registration-${randomUUID()}`, id, actor.id]
      );
    }
    const nextCount = registeredCount + 1;
    await client.query(
      `update training_session
       set status = $2, updated_at = now()
       where id = $1`,
      [id, nextCount >= session.capacity ? 'FULL' : 'OPEN']
    );
  });
  return getTrainingSessionDetail(id, actor);
}

export async function cancelTrainingRegistration(id: string, actor: SessionUser) {
  if (actor.role === 'ADMIN') throw new PermissionDeniedError();
  if (!hasDatabase()) throw new TrainingSessionStateError('Training cancellation requires database storage');

  await transaction(async (client) => {
    const sessionResult = await client.query<{
      applyDeadline: Date | string;
      capacity: number;
      status: TrainingSessionStatus;
    }>(
      `select apply_deadline as "applyDeadline", capacity, status
       from training_session
       where id = $1 and deleted_at is null
       for update`,
      [id]
    );
    const session = sessionResult.rows[0];
    if (!session) throw new TrainingSessionStateError('Training session not found');
    const deadline = new Date(normalizeDate(session.applyDeadline) ?? '');
    if (deadline.getTime() <= Date.now() || session.status === 'CANCELED' || session.status === 'DONE') {
      throw new TrainingSessionStateError('Training cancellation deadline has passed');
    }
    const updated = await client.query(
      `update session_registration
       set status = 'CANCELED', canceled_at = now(), updated_at = now()
       where session_id = $1 and user_id = $2 and status = 'REGISTERED'`,
      [id, actor.id]
    );
    if (updated.rowCount === 0) throw new TrainingSessionStateError('Active registration not found');

    const countResult = await client.query<{ count: string }>(
      `select count(*)::int as count
       from session_registration
       where session_id = $1 and status = 'REGISTERED'`,
      [id]
    );
    const registeredCount = Number(countResult.rows[0]?.count ?? 0);
    await client.query(
      `update training_session
       set status = $2, updated_at = now()
       where id = $1 and status in ('OPEN', 'FULL')`,
      [id, registeredCount >= session.capacity ? 'FULL' : 'OPEN']
    );
  });
  return getTrainingSessionDetail(id, actor);
}

async function assertSessionManageable(client: { query: typeof query }, id: string, actor: SessionUser) {
  const result = await client.query<{
    equipmentId: string;
    managerId: string | null;
    applyDeadline: Date | string;
    status: TrainingSessionStatus;
  }>(
    `select equipment_id as "equipmentId", manager_id as "managerId", apply_deadline as "applyDeadline", status
     from training_session
     where id = $1 and deleted_at is null
     for update`,
    [id]
  );
  const session = result.rows[0];
  if (!session) throw new TrainingSessionStateError('Training session not found');
  if (actor.role !== 'ADMIN' && session.managerId !== actor.id) throw new PermissionDeniedError();
  if (session.status === 'CANCELED') throw new TrainingSessionStateError('Training session is canceled');
  if (new Date(normalizeDate(session.applyDeadline) ?? '').getTime() > Date.now()) {
    throw new TrainingSessionStateError('Training session can be processed after the apply deadline');
  }
  return session;
}

async function updateSessionDoneIfSettled(client: { query: typeof query }, id: string) {
  const countResult = await client.query<{ count: string }>(
    `select count(*)::int as count
     from session_registration
     where session_id = $1 and status = 'REGISTERED'`,
    [id]
  );
  if (Number(countResult.rows[0]?.count ?? 0) === 0) {
    await client.query(
      `update training_session
       set status = 'DONE', updated_at = now()
       where id = $1 and status in ('OPEN', 'FULL', 'CLOSED')`,
      [id]
    );
  }
}

export async function completeTrainingSessionRegistrations(id: string, input: unknown, actor: SessionUser) {
  const body = userIdsSchema.parse(input);
  if (!hasDatabase()) throw new TrainingSessionStateError('Training completion requires database storage');

  await transaction(async (client) => {
    const session = await assertSessionManageable(client, id, actor);
    const registrations = await client.query<{ id: string; userId: string }>(
      `select id, user_id as "userId"
       from session_registration
       where session_id = $1 and user_id = any($2::text[]) and status = 'REGISTERED'
       for update`,
      [id, body.userIds]
    );
    if (registrations.rows.length !== body.userIds.length) {
      throw new TrainingSessionStateError('Some registrations are not active');
    }
    for (const registration of registrations.rows) {
      await client.query(
        `update session_registration
         set status = 'COMPLETED', completed_at = now(), updated_at = now()
         where id = $1`,
        [registration.id]
      );
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
        [registration.userId, session.equipmentId, actor.id, actor.role, `session-registration:${registration.id}`]
      );
      await client.query(
        `insert into equipment_permission_events (
          id, action, actor_id, actor_role, user_id, equipment_id, reason
        )
        values ($1, 'GRANT', $2, $3, $4, $5, $6)`,
        [
          `permission-event-${randomUUID()}`,
          actor.id,
          actor.role,
          registration.userId,
          session.equipmentId,
          `training_session:${id}`
        ]
      );
      await client.query(
        `update users
         set onboarding_status = 'active', updated_at = now()
         where id = $1 and deleted_at is null`,
        [registration.userId]
      );
    }
    await updateSessionDoneIfSettled(client, id);
  });
  return getTrainingSessionDetail(id, actor);
}

export async function noShowTrainingSessionRegistrations(id: string, input: unknown, actor: SessionUser) {
  const body = userIdsSchema.parse(input);
  if (!hasDatabase()) throw new TrainingSessionStateError('Training no-show requires database storage');

  await transaction(async (client) => {
    const session = await assertSessionManageable(client, id, actor);
    const registrations = await client.query<{ id: string; userId: string }>(
      `select id, user_id as "userId"
       from session_registration
       where session_id = $1 and user_id = any($2::text[]) and status = 'REGISTERED'
       for update`,
      [id, body.userIds]
    );
    if (registrations.rows.length !== body.userIds.length) {
      throw new TrainingSessionStateError('Some registrations are not active');
    }
    for (const registration of registrations.rows) {
      await client.query(
        `update session_registration
         set status = 'NO_SHOW', no_show_at = now(), updated_at = now()
         where id = $1`,
        [registration.id]
      );
      await client.query(
        `insert into penalty_candidate (
          id, user_id, equipment_id, session_id, registration_id, origin, status, created_by, reason
        )
        values ($1, $2, $3, $4, $5, 'NO_SHOW', 'PENDING', $6, $7)
        on conflict (registration_id) do nothing`,
        [
          `penalty-candidate-${randomUUID()}`,
          registration.userId,
          session.equipmentId,
          id,
          registration.id,
          actor.id,
          body.reason ?? '교육 노쇼'
        ]
      );
    }
    await updateSessionDoneIfSettled(client, id);
  });
  return getTrainingSessionDetail(id, actor);
}

export async function listPenaltyCandidates(input: unknown) {
  const body = candidateStatusSchema.parse(input);
  if (!hasDatabase()) return fallbackPenaltyCandidates.filter((candidate) => candidate.status === body.status);
  const result = await query<PenaltyCandidateRow>(
    `select pc.id,
      pc.user_id as "userId",
      u.name as "userName",
      u.email as "userEmail",
      u.department as "userDepartment",
      pc.equipment_id as "equipmentId",
      e.name as "equipmentName",
      pc.session_id as "sessionId",
      pc.registration_id as "registrationId",
      pc.created_by as "managerId",
      manager.name as "managerName",
      ts.apply_deadline as "applyDeadline",
      pc.origin,
      pc.status,
      pc.reason,
      pc.review_reason as "reviewReason",
      pc.created_at as "createdAt",
      pc.reviewed_at as "reviewedAt"
     from penalty_candidate pc
     join users u on u.id = pc.user_id and u.deleted_at is null
     join equipment e on e.id = pc.equipment_id and e.deleted_at is null
     join training_session ts on ts.id = pc.session_id and ts.deleted_at is null
     left join users manager on manager.id = pc.created_by and manager.deleted_at is null
     where pc.status = $1
     order by pc.created_at desc`,
    [body.status]
  );
  return result.rows.map(mapPenaltyCandidate);
}

export async function confirmPenaltyCandidate(id: string, input: unknown, actor: SessionUser) {
  const body = confirmCandidateSchema.parse(input);
  const startsAt = body.startsAt ?? new Date().toISOString();
  const noShowPenaltyType = '6개월 사용정지';
  const noShowPenaltyEndsAt = addMonths(startsAt, 6);
  if (!hasDatabase()) throw new TrainingSessionStateError('Penalty candidate confirmation requires database storage');

  await transaction(async (client) => {
    const candidate = await client.query<{ userId: string; reason: string | null }>(
      `select user_id as "userId", reason
       from penalty_candidate
       where id = $1 and status = 'PENDING'
       for update`,
      [id]
    );
    const row = candidate.rows[0];
    if (!row) throw new TrainingSessionStateError('Pending penalty candidate not found');
    await client.query(
      `insert into penalty_records (id, user_id, type, category, reason, starts_at, ends_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        `penalty-${randomUUID()}`,
        row.userId,
        noShowPenaltyType,
        body.category,
        body.reason ?? row.reason ?? '교육 노쇼',
        startsAt,
        noShowPenaltyEndsAt
      ]
    );
    await client.query(
      `update penalty_candidate
       set status = 'CONFIRMED', reviewed_by = $2, review_reason = $3, reviewed_at = now()
       where id = $1`,
      [id, actor.id, body.reason ?? null]
    );
  });
  const candidates = await listPenaltyCandidates({ status: 'CONFIRMED' });
  return candidates.find((candidate) => candidate.id === id) ?? null;
}

export async function rejectPenaltyCandidate(id: string, input: unknown, actor: SessionUser) {
  const body = rejectCandidateSchema.parse(input);
  if (!hasDatabase()) throw new TrainingSessionStateError('Penalty candidate rejection requires database storage');
  const result = await query(
    `update penalty_candidate
     set status = 'REJECTED', reviewed_by = $2, review_reason = $3, reviewed_at = now()
     where id = $1 and status = 'PENDING'`,
    [id, actor.id, body.reason]
  );
  if (result.rowCount === 0) return null;
  const candidates = await listPenaltyCandidates({ status: 'REJECTED' });
  return candidates.find((candidate) => candidate.id === id) ?? null;
}
