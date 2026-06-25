import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SessionUser } from './auth.js';
import { equipment as fallbackEquipment, reservations as fallbackReservations } from './data.js';
import { hasDatabase, query, transaction } from './db.js';

type Equipment = typeof fallbackEquipment[number];
type FallbackReservation = typeof fallbackReservations[number] & {
  purpose?: string;
  userId?: string;
  createdByRole?: string;
};

const mutableFallbackReservations = fallbackReservations as FallbackReservation[];

export class ReservationOverlapError extends Error {
  constructor() {
    super('Reservation overlaps existing booking');
    this.name = 'ReservationOverlapError';
  }
}

const reservationStatusSchema = z.enum(['pending', 'approved', 'maintenance', 'external', 'canceled']);

const createReservationSchema = z.object({
  equipmentId: z.string().min(1),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  purpose: z.string().min(5),
  title: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  status: reservationStatusSchema.optional()
}).refine((value) => new Date(value.startsAt) < new Date(value.endsAt), {
  message: 'Reservation end time must be after start time',
  path: ['endsAt']
});

type CreateReservationInput = z.infer<typeof createReservationSchema>;

type EquipmentRow = {
  id: string;
  name: string;
  model: string | null;
  category: string;
  group: string;
  groupName: string;
  location: string;
  imageUrl: string | null;
  features: unknown;
  usageConditions: string;
  description: string | null;
  vendorName: string | null;
  vendorContactName: string | null;
  vendorContactPosition: string | null;
  vendorContactPhone: string | null;
  utilization: number;
  usageHours: number;
  status: string;
  managerUserId: string | null;
};

type ReservationRow = {
  id: string;
  equipmentId: string;
  userId: string | null;
  title: string;
  purpose: string;
  startsAt: Date | string;
  endsAt: Date | string;
  status: z.infer<typeof reservationStatusSchema>;
  createdByRole: string | null;
};

function normalizeDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapEquipment(row: EquipmentRow): Equipment & { status?: string; managerUserId?: string | null } {
  return {
    id: row.id,
    name: row.name,
    model: row.model ?? '',
    category: row.category,
    group: row.group === 'process' ? 'process' : 'metrology',
    groupName: row.groupName,
    location: row.location,
    imageUrl: row.imageUrl ?? '',
    features: Array.isArray(row.features) ? row.features as string[] : [],
    usageConditions: row.usageConditions,
    description: row.description ?? '',
    vendorName: row.vendorName ?? '',
    vendorContactName: row.vendorContactName ?? '',
    vendorContactPosition: row.vendorContactPosition ?? '',
    vendorContactPhone: row.vendorContactPhone ?? '',
    utilization: row.utilization,
    usageHours: row.usageHours,
    status: row.status,
    managerUserId: row.managerUserId
  };
}

function mapReservation(row: ReservationRow) {
  return {
    id: row.id,
    equipmentId: row.equipmentId,
    userId: row.userId ?? undefined,
    title: row.title,
    purpose: row.purpose,
    startsAt: normalizeDate(row.startsAt),
    endsAt: normalizeDate(row.endsAt),
    status: row.status,
    createdByRole: row.createdByRole ?? undefined
  };
}

function hasReservationOverlap(input: CreateReservationInput, reservations: FallbackReservation[]) {
  return reservations.some((reservation) =>
    reservation.equipmentId === input.equipmentId &&
    reservation.status !== 'canceled' &&
    new Date(input.startsAt) < new Date(reservation.endsAt) &&
    new Date(input.endsAt) > new Date(reservation.startsAt)
  );
}

function canAssignReservationOwner(user?: SessionUser) {
  return user?.role === 'ADMIN' || user?.role === 'MANAGER';
}

function canCancelAnyReservation(user: SessionUser) {
  return user.role === 'ADMIN';
}

export async function listEquipment() {
  if (!hasDatabase()) return fallbackEquipment;
  const result = await query<EquipmentRow>(
    `select id, name, model, category, group_key as "group", group_name as "groupName",
      location, image_url as "imageUrl", features, usage_conditions as "usageConditions",
      description, vendor_name as "vendorName", vendor_contact_name as "vendorContactName",
      vendor_contact_position as "vendorContactPosition", vendor_contact_phone as "vendorContactPhone",
      utilization, usage_hours as "usageHours", status, manager_user_id as "managerUserId"
     from equipment
     where deleted_at is null
     order by nullif(regexp_replace(id, '\\D', '', 'g'), '')::integer nulls last, id`
  );
  return result.rows.map(mapEquipment);
}

export async function getEquipment(id: string) {
  if (!hasDatabase()) return fallbackEquipment.find((entry) => entry.id === id) ?? null;
  const result = await query<EquipmentRow>(
    `select id, name, model, category, group_key as "group", group_name as "groupName",
      location, image_url as "imageUrl", features, usage_conditions as "usageConditions",
      description, vendor_name as "vendorName", vendor_contact_name as "vendorContactName",
      vendor_contact_position as "vendorContactPosition", vendor_contact_phone as "vendorContactPhone",
      utilization, usage_hours as "usageHours", status, manager_user_id as "managerUserId"
     from equipment
     where id = $1 and deleted_at is null`,
    [id]
  );
  return result.rows[0] ? mapEquipment(result.rows[0]) : null;
}

export async function listReservations() {
  if (!hasDatabase()) return mutableFallbackReservations;
  const result = await query<ReservationRow>(
    `select id, equipment_id as "equipmentId", user_id as "userId", title, purpose,
      starts_at as "startsAt", ends_at as "endsAt", status, created_by_role as "createdByRole"
     from reservations
     where deleted_at is null
     order by starts_at desc`
  );
  return result.rows.map(mapReservation);
}

export async function createReservation(input: unknown, user?: SessionUser) {
  const body = createReservationSchema.parse(input);
  const canAssignOwner = canAssignReservationOwner(user);
  const ownerId = canAssignOwner ? (body.userId ?? user?.id ?? null) : (user?.id ?? null);
  const status = canAssignOwner ? (body.status ?? 'pending') : 'pending';
  const reservationId = `r-${randomUUID()}`;

  if (!hasDatabase()) {
    if (hasReservationOverlap(body, mutableFallbackReservations)) throw new ReservationOverlapError();
    const reservation: FallbackReservation = {
      id: reservationId,
      equipmentId: body.equipmentId,
      title: body.title ?? body.purpose,
      purpose: body.purpose,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      status,
      userId: ownerId ?? undefined,
      createdByRole: user?.role
    };
    mutableFallbackReservations.push(reservation);
    return reservation;
  }

  try {
    return await transaction(async (client) => {
      const result = await client.query<ReservationRow>(
        `insert into reservations (
          id, equipment_id, user_id, title, purpose, starts_at, ends_at, status, created_by_role
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        returning id, equipment_id as "equipmentId", user_id as "userId", title, purpose,
          starts_at as "startsAt", ends_at as "endsAt", status, created_by_role as "createdByRole"`,
        [
          reservationId,
          body.equipmentId,
          ownerId,
          body.title ?? body.purpose,
          body.purpose,
          body.startsAt,
          body.endsAt,
          status,
          user?.role ?? null
        ]
      );
      return mapReservation(result.rows[0]);
    });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23P01') {
      throw new ReservationOverlapError();
    }
    throw error;
  }
}

export async function cancelReservation(id: string, user: SessionUser) {
  const canCancelAny = canCancelAnyReservation(user);

  if (!hasDatabase()) {
    const index = mutableFallbackReservations.findIndex((reservation) => (
      reservation.id === id &&
      (canCancelAny || reservation.userId === user.id)
    ));
    if (index === -1) return null;
    const [removed] = mutableFallbackReservations.splice(index, 1);
    return removed;
  }

  const result = await query<ReservationRow>(
    `update reservations
     set status = 'canceled', deleted_at = now(), updated_at = now()
     where id = $1 and deleted_at is null and ($2 = true or user_id = $3)
     returning id, equipment_id as "equipmentId", user_id as "userId", title, purpose,
       starts_at as "startsAt", ends_at as "endsAt", status, created_by_role as "createdByRole"`,
    [id, canCancelAny, user.id]
  );
  return result.rows[0] ? mapReservation(result.rows[0]) : null;
}
