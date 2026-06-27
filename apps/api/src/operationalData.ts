import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SessionUser } from './auth.js';
import { hasDatabase, query, transaction } from './db.js';

const consumableItemSchema = z.object({
  id: z.string().min(1).optional(),
  category: z.string().default(''),
  name: z.string().min(1),
  unit: z.string().default(''),
  monthStart: z.number().int().min(0).default(0),
  current: z.number().int().min(0).default(0),
  minimum: z.number().int().min(0).default(0),
  note: z.string().default('')
});

const consumableSaveSchema = z.union([
  z.array(consumableItemSchema),
  z.object({ items: z.array(consumableItemSchema) })
]);

const penaltyCreateSchema = z.object({
  userId: z.string().min(1),
  type: z.string().min(1),
  category: z.string().min(1),
  reason: z.string().min(1),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional()
});

type ConsumableItem = z.infer<typeof consumableItemSchema> & { id: string };

type ConsumableRow = {
  id: string;
  category: string;
  name: string;
  unit: string;
  monthStart: number;
  current: number;
  minimum: number;
  note: string;
};

type PenaltyRecord = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: string;
  category: string;
  reason: string;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  revokedAt?: string;
};

type PenaltyRow = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  type: string;
  category: string;
  reason: string;
  startsAt: Date | string;
  endsAt: Date | string | null;
  createdAt: Date | string;
  revokedAt: Date | string | null;
};

const fallbackConsumables: Record<string, ConsumableItem[]> = {};
const fallbackPenalties: PenaltyRecord[] = [];

export const operationalDataSchemaStatements = [
  `create table if not exists consumable_items (
    id text primary key,
    month text not null,
    category text not null default '',
    name text not null,
    unit text not null default '',
    month_start integer not null default 0 check (month_start >= 0),
    current_count integer not null default 0 check (current_count >= 0),
    minimum_count integer not null default 0 check (minimum_count >= 0),
    note text not null default '',
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
  )`,
  `create index if not exists consumable_items_month_idx on consumable_items (month, sort_order, name) where deleted_at is null`,
  `create table if not exists penalty_records (
    id text primary key,
    user_id text not null references users(id) on delete cascade,
    type text not null,
    category text not null,
    reason text not null,
    starts_at timestamptz not null,
    ends_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
  )`,
  `create index if not exists penalty_records_user_active_idx on penalty_records (user_id, starts_at desc) where deleted_at is null`
];

export async function ensureOperationalDataSchema() {
  if (!hasDatabase()) return;
  for (const statement of operationalDataSchemaStatements) {
    await query(statement);
  }
}

function normalizeDate(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function mapPenalty(row: PenaltyRow): PenaltyRecord {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.userName ?? row.userId,
    userEmail: row.userEmail ?? '',
    type: row.type,
    category: row.category,
    reason: row.reason,
    startsAt: normalizeDate(row.startsAt) ?? '',
    endsAt: normalizeDate(row.endsAt),
    createdAt: normalizeDate(row.createdAt) ?? '',
    ...(row.revokedAt ? { revokedAt: normalizeDate(row.revokedAt) ?? undefined } : {})
  };
}

function parseConsumableItems(input: unknown) {
  const parsed = consumableSaveSchema.parse(input);
  return Array.isArray(parsed) ? parsed : parsed.items;
}

export async function listConsumables(month: string) {
  if (!hasDatabase()) return fallbackConsumables[month] ?? [];

  const result = await query<ConsumableRow>(
    `select id, category, name, unit, month_start as "monthStart",
      current_count as "current", minimum_count as "minimum", note
     from consumable_items
     where month = $1 and deleted_at is null
     order by sort_order asc, name asc`,
    [month]
  );
  return result.rows;
}

export async function saveConsumables(month: string, input: unknown) {
  const items = parseConsumableItems(input).map((item, index) => ({
    ...item,
    id: item.id ?? `supply-${month}-${randomUUID()}`,
    sortOrder: index
  }));

  if (!hasDatabase()) {
    fallbackConsumables[month] = items;
    return fallbackConsumables[month];
  }

  await transaction(async (client) => {
    await client.query(
      `update consumable_items
       set deleted_at = now(), updated_at = now()
       where month = $1 and deleted_at is null`,
      [month]
    );

    for (const item of items) {
      await client.query(
        `insert into consumable_items (
          id, month, category, name, unit, month_start, current_count, minimum_count, note, sort_order, deleted_at, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, null, now())
        on conflict (id) do update
        set month = excluded.month,
          category = excluded.category,
          name = excluded.name,
          unit = excluded.unit,
          month_start = excluded.month_start,
          current_count = excluded.current_count,
          minimum_count = excluded.minimum_count,
          note = excluded.note,
          sort_order = excluded.sort_order,
          deleted_at = null,
          updated_at = now()`,
        [
          item.id,
          month,
          item.category,
          item.name,
          item.unit,
          item.monthStart,
          item.current,
          item.minimum,
          item.note,
          item.sortOrder
        ]
      );
    }
  });

  return listConsumables(month);
}

export async function listPenalties(actor: SessionUser) {
  if (!hasDatabase()) {
    return actor.role === 'ADMIN'
      ? fallbackPenalties
      : fallbackPenalties.filter((penalty) => penalty.userId === actor.id);
  }

  const params: unknown[] = [];
  const where = ['pr.deleted_at is null'];
  if (actor.role !== 'ADMIN') {
    params.push(actor.id);
    where.push(`pr.user_id = $${params.length}`);
  }

  const result = await query<PenaltyRow>(
    `select pr.id,
      pr.user_id as "userId",
      u.name as "userName",
      u.email as "userEmail",
      pr.type,
      pr.category,
      pr.reason,
      pr.starts_at as "startsAt",
      pr.ends_at as "endsAt",
      pr.created_at as "createdAt",
      pr.revoked_at as "revokedAt"
     from penalty_records pr
     join users u on u.id = pr.user_id
     where ${where.join(' and ')}
     order by pr.created_at desc`,
    params
  );
  return result.rows.map(mapPenalty);
}

export async function createPenalty(input: unknown, actor: SessionUser) {
  const body = penaltyCreateSchema.parse(input);
  const id = `penalty-${randomUUID()}`;
  const startsAt = body.startsAt ?? new Date().toISOString();

  if (!hasDatabase()) {
    const record: PenaltyRecord = {
      id,
      userId: body.userId,
      userName: body.userId,
      userEmail: '',
      type: body.type,
      category: body.category,
      reason: body.reason,
      startsAt,
      endsAt: body.endsAt ?? null,
      createdAt: new Date().toISOString()
    };
    fallbackPenalties.unshift(record);
    return record;
  }

  const result = await query<PenaltyRow>(
    `insert into penalty_records (id, user_id, type, category, reason, starts_at, ends_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id,
      user_id as "userId",
      null::text as "userName",
      null::text as "userEmail",
      type,
      category,
      reason,
      starts_at as "startsAt",
      ends_at as "endsAt",
      created_at as "createdAt",
      revoked_at as "revokedAt"`,
    [id, body.userId, body.type, body.category, body.reason, startsAt, body.endsAt ?? null]
  );
  const [created] = await listPenalties(actor);
  return created ?? mapPenalty(result.rows[0]);
}

export async function revokePenalty(id: string, actor: SessionUser) {
  if (!hasDatabase()) {
    const index = fallbackPenalties.findIndex((penalty) => penalty.id === id);
    if (index === -1) return null;
    fallbackPenalties[index] = { ...fallbackPenalties[index], revokedAt: new Date().toISOString() };
    return fallbackPenalties[index];
  }

  const result = await query<PenaltyRow>(
    `update penalty_records
     set revoked_at = now(), updated_at = now()
     where id = $1 and deleted_at is null
     returning id,
      user_id as "userId",
      null::text as "userName",
      null::text as "userEmail",
      type,
      category,
      reason,
      starts_at as "startsAt",
      ends_at as "endsAt",
      created_at as "createdAt",
      revoked_at as "revokedAt"`,
    [id]
  );
  if (!result.rows[0]) return null;
  const penalties = await listPenalties(actor);
  return penalties.find((penalty) => penalty.id === id) ?? mapPenalty(result.rows[0]);
}
