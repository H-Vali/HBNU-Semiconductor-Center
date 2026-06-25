import { z } from 'zod';
import { equipment as fallbackEquipment, reservations as fallbackReservations } from './data.js';
import { hasDatabase, query, transaction } from './db.js';

type SessionUser = {
  id: string;
  role: string;
};

type Equipment = typeof fallbackEquipment[number];
type FallbackReservation = typeof fallbackReservations[number];

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
  category: string;
  location: string;
  imageUrl: string | null;
  features: unknown;
  usageConditions: string;
  utilization: number;
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
    category: row.category,
    location: row.location,
    imageUrl: row.imageUrl ?? '',
    features: Array.isArray(row.features) ? row.features as string[] : [],
    usageConditions: row.usageConditions,
    utilization: row.utilization,
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

export async function listEquipment() {
  if (!hasDatabase()) return fallbackEquipment;
  const result = await query<EquipmentRow>(
    `select id, name, category, location, image_url as "imageUrl", features,
      usage_conditions as "usageConditions", utilization, status, manager_user_id as "managerUserId"
     from equipment
     where deleted_at is null
     order by id`
  );
  return result.rows.map(mapEquipment);
}

export async function getEquipment(id: string) {
  if (!hasDatabase()) return fallbackEquipment.find((entry) => entry.id === id) ?? null;
  const result = await query<EquipmentRow>(
    `select id, name, category, location, image_url as "imageUrl", features,
      usage_conditions as "usageConditions", utilization, status, manager_user_id as "managerUserId"
     from equipment
     where id = $1 and deleted_at is null`,
    [id]
  );
  return result.rows[0] ? mapEquipment(result.rows[0]) : null;
}

export async function listReservations() {
  if (!hasDatabase()) return fallbackReservations;
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
  if (!hasDatabase()) {
    if (hasReservationOverlap(body, fallbackReservations)) throw new ReservationOverlapError();
    const reservation = {
      id: `r-${Date.now()}`,
      equipmentId: body.equipmentId,
      title: body.title ?? body.purpose,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      status: body.status ?? 'pending'
    };
    fallbackReservations.push(reservation);
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
          `r-${Date.now()}`,
          body.equipmentId,
          body.userId ?? user?.id ?? null,
          body.title ?? body.purpose,
          body.purpose,
          body.startsAt,
          body.endsAt,
          body.status ?? 'pending',
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
