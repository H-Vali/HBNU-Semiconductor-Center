import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SessionUser } from './auth.js';
import { equipment as fallbackEquipment, reservations as fallbackReservations } from './data.js';
import { hasDatabase, query, transaction } from './db.js';
import { hasActiveEquipmentPermission } from './permissions.js';

type Equipment = typeof fallbackEquipment[number];
type MutableEquipment = Equipment & {
  image?: string;
  condition?: string;
  managerId?: string;
  imageUrl?: string;
  usageConditions?: string;
  managerUserId?: string | null;
};
type FallbackReservation = typeof fallbackReservations[number] & {
  purpose?: string;
  userId?: string;
  createdByRole?: string;
};

const mutableFallbackEquipment = fallbackEquipment as MutableEquipment[];
const mutableFallbackReservations = fallbackReservations as FallbackReservation[];

export class ReservationOverlapError extends Error {
  constructor() {
    super('Reservation overlaps existing booking');
    this.name = 'ReservationOverlapError';
  }
}

export class ReservationPermissionError extends Error {
  constructor() {
    super('Equipment reservation permission required');
    this.name = 'ReservationPermissionError';
  }
}

const reservationStatusSchema = z.enum(['pending', 'approved', 'rejected', 'maintenance', 'external', 'canceled']);
const equipmentGroupSchema = z.enum(['process', 'metrology']);
const equipmentStatusSchema = z.enum(['available', 'unavailable', 'maintenance']);

const equipmentInputSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  model: z.string().optional(),
  category: z.string().min(1),
  group: equipmentGroupSchema,
  groupName: z.string().min(1),
  location: z.string().min(1),
  image: z.string().optional(),
  imageUrl: z.string().optional(),
  features: z.array(z.string()).default([]),
  condition: z.string().optional(),
  usageConditions: z.string().optional(),
  description: z.string().optional(),
  vendorName: z.string().optional(),
  vendorContactName: z.string().optional(),
  vendorContactPosition: z.string().optional(),
  vendorContactPhone: z.string().optional(),
  utilization: z.number().int().min(0).max(100).default(0),
  usageHours: z.number().int().min(0).default(0),
  status: equipmentStatusSchema.default('available'),
  managerId: z.string().min(1).nullable().optional(),
  managerUserId: z.string().min(1).nullable().optional()
});

const equipmentPatchSchema = equipmentInputSchema.partial().omit({ id: true });

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

const reservationStatusUpdateSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'canceled']),
  reason: z.string().trim().optional()
});

type CreateReservationInput = z.infer<typeof createReservationSchema>;
type EquipmentInput = z.infer<typeof equipmentInputSchema>;
type EquipmentPatch = z.infer<typeof equipmentPatchSchema>;

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

function normalizeEquipmentInput(input: EquipmentInput) {
  const imageUrl = input.imageUrl ?? input.image ?? '';
  const usageConditions = input.usageConditions ?? input.condition ?? '';
  return {
    ...input,
    imageUrl,
    usageConditions,
    model: input.model ?? '',
    description: input.description ?? '',
    vendorName: input.vendorName ?? '',
    vendorContactName: input.vendorContactName ?? '',
    vendorContactPosition: input.vendorContactPosition ?? '',
    vendorContactPhone: input.vendorContactPhone ?? '',
    managerUserId: input.managerUserId !== undefined
      ? input.managerUserId
      : input.managerId !== undefined
        ? input.managerId
        : null
  };
}

function normalizeEquipmentPatch(input: EquipmentPatch) {
  const imageUrl = input.imageUrl ?? input.image;
  const usageConditions = input.usageConditions ?? input.condition;
  const hasManagerPatch = input.managerUserId !== undefined || input.managerId !== undefined;
  return {
    ...input,
    ...(imageUrl !== undefined ? { imageUrl } : {}),
    ...(usageConditions !== undefined ? { usageConditions } : {}),
    ...(hasManagerPatch
      ? { managerUserId: input.managerUserId !== undefined ? input.managerUserId : input.managerId ?? null }
      : {})
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

async function canManageReservationStatus(reservationId: string, user: SessionUser) {
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'MANAGER') return false;
  if (!hasDatabase()) return false;

  const result = await query<{ managerUserId: string | null }>(
    `select e.manager_user_id as "managerUserId"
     from reservations r
     join equipment e on e.id = r.equipment_id
     where r.id = $1 and r.deleted_at is null and e.deleted_at is null
     limit 1`,
    [reservationId]
  );
  return result.rows[0]?.managerUserId === user.id;
}

async function getReservationEquipmentStatus(equipmentId: string) {
  if (!hasDatabase()) {
    return mutableFallbackEquipment.find((entry) => entry.id === equipmentId)?.status ?? null;
  }

  const result = await query<{ status: string }>(
    `select status
     from equipment
     where id = $1 and deleted_at is null
     limit 1`,
    [equipmentId]
  );
  return result.rows[0]?.status ?? null;
}

async function isEquipmentManager(user: SessionUser, equipmentId: string) {
  if (user.role !== 'MANAGER') return false;
  if (!hasDatabase()) {
    return mutableFallbackEquipment.some((entry) => (
      entry.id === equipmentId && (entry.managerUserId ?? entry.managerId) === user.id
    ));
  }

  const result = await query<{ isManager: boolean }>(
    `select exists (
      select 1
      from equipment
      where id = $1 and manager_user_id = $2 and deleted_at is null
    ) as "isManager"`,
    [equipmentId, user.id]
  );
  return Boolean(result.rows[0]?.isManager);
}

async function canCreateReservation(body: CreateReservationInput, user?: SessionUser) {
  if (!user) return false;
  const equipmentStatus = await getReservationEquipmentStatus(body.equipmentId);
  if (!equipmentStatus) return false;
  if (user.role === 'ADMIN') return true;
  if (body.userId && body.userId !== user.id) return false;
  if (equipmentStatus !== 'available') return false;
  if (await isEquipmentManager(user, body.equipmentId)) return true;

  if (!hasDatabase()) {
    return hasActiveEquipmentPermission(user.id, body.equipmentId);
  }

  const result = await query<{ onboardingStatus: string; hasPermission: boolean; hasAdminGrantedPermission: boolean }>(
    `select u.onboarding_status as "onboardingStatus",
      exists (
        select 1
        from equipment_permissions ep
        where ep.user_id = u.id and ep.equipment_id = $2 and ep.revoked_at is null
      ) as "hasPermission",
      exists (
        select 1
        from equipment_permissions ep
        where ep.user_id = u.id
          and ep.equipment_id = $2
          and ep.revoked_at is null
          and ep.granted_by_role = 'ADMIN'
      ) as "hasAdminGrantedPermission"
     from users u
     where u.id = $1 and u.deleted_at is null
     limit 1`,
    [user.id, body.equipmentId]
  );
  const row = result.rows[0];
  return Boolean(row?.hasAdminGrantedPermission || (row?.onboardingStatus === 'active' && row.hasPermission));
}

export async function listEquipment() {
  if (!hasDatabase()) return mutableFallbackEquipment;
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
  if (!hasDatabase()) return mutableFallbackEquipment.find((entry) => entry.id === id) ?? null;
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

export async function createEquipment(input: unknown) {
  const body = normalizeEquipmentInput(equipmentInputSchema.parse(input));
  const id = body.id ?? `eq-${randomUUID()}`;

  if (!hasDatabase()) {
    const item: MutableEquipment = {
      id,
      name: body.name,
      model: body.model,
      category: body.category,
      group: body.group,
      groupName: body.groupName,
      location: body.location,
      image: body.imageUrl,
      imageUrl: body.imageUrl,
      features: body.features,
      condition: body.usageConditions,
      usageConditions: body.usageConditions,
      description: body.description,
      vendorName: body.vendorName,
      vendorContactName: body.vendorContactName,
      vendorContactPosition: body.vendorContactPosition,
      vendorContactPhone: body.vendorContactPhone,
      utilization: body.utilization,
      usageHours: body.usageHours,
      status: body.status === 'maintenance' ? 'unavailable' : body.status,
      managerUserId: body.managerUserId,
      managerId: body.managerUserId ?? undefined
    };
    mutableFallbackEquipment.push(item);
    return item;
  }

  const result = await query<EquipmentRow>(
    `insert into equipment (
      id, name, model, category, group_key, group_name, location, image_url, features,
      usage_conditions, description, vendor_name, vendor_contact_name, vendor_contact_position,
      vendor_contact_phone, utilization, usage_hours, status, manager_user_id
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    returning id, name, model, category, group_key as "group", group_name as "groupName",
      location, image_url as "imageUrl", features, usage_conditions as "usageConditions",
      description, vendor_name as "vendorName", vendor_contact_name as "vendorContactName",
      vendor_contact_position as "vendorContactPosition", vendor_contact_phone as "vendorContactPhone",
      utilization, usage_hours as "usageHours", status, manager_user_id as "managerUserId"`,
    [
      id,
      body.name,
      body.model,
      body.category,
      body.group,
      body.groupName,
      body.location,
      body.imageUrl,
      JSON.stringify(body.features),
      body.usageConditions,
      body.description,
      body.vendorName,
      body.vendorContactName,
      body.vendorContactPosition,
      body.vendorContactPhone,
      body.utilization,
      body.usageHours,
      body.status,
      body.managerUserId
    ]
  );
  return mapEquipment(result.rows[0]);
}

export async function updateEquipment(id: string, input: unknown) {
  const patch = normalizeEquipmentPatch(equipmentPatchSchema.parse(input));

  if (!hasDatabase()) {
    const index = mutableFallbackEquipment.findIndex((entry) => entry.id === id);
    if (index === -1) return null;
    mutableFallbackEquipment[index] = {
      ...mutableFallbackEquipment[index],
      ...patch,
      image: patch.imageUrl ?? patch.image ?? mutableFallbackEquipment[index].image,
      condition: patch.usageConditions ?? patch.condition ?? mutableFallbackEquipment[index].condition,
      status: patch.status === 'maintenance' ? 'unavailable' : (patch.status ?? mutableFallbackEquipment[index].status),
      managerId: patch.managerUserId !== undefined
        ? patch.managerUserId ?? undefined
        : patch.managerId !== undefined
          ? patch.managerId ?? undefined
          : mutableFallbackEquipment[index].managerId
    };
    return mutableFallbackEquipment[index];
  }

  const result = await query<EquipmentRow>(
    `update equipment
     set name = coalesce($2, name),
       model = coalesce($3, model),
       category = coalesce($4, category),
       group_key = coalesce($5, group_key),
       group_name = coalesce($6, group_name),
       location = coalesce($7, location),
       image_url = coalesce($8, image_url),
       features = coalesce($9::jsonb, features),
       usage_conditions = coalesce($10, usage_conditions),
       description = coalesce($11, description),
       vendor_name = coalesce($12, vendor_name),
       vendor_contact_name = coalesce($13, vendor_contact_name),
       vendor_contact_position = coalesce($14, vendor_contact_position),
       vendor_contact_phone = coalesce($15, vendor_contact_phone),
       utilization = coalesce($16, utilization),
       usage_hours = coalesce($17, usage_hours),
       status = coalesce($18, status),
       manager_user_id = case when $19::boolean then $20 else manager_user_id end,
       updated_at = now()
     where id = $1 and deleted_at is null
     returning id, name, model, category, group_key as "group", group_name as "groupName",
       location, image_url as "imageUrl", features, usage_conditions as "usageConditions",
       description, vendor_name as "vendorName", vendor_contact_name as "vendorContactName",
       vendor_contact_position as "vendorContactPosition", vendor_contact_phone as "vendorContactPhone",
       utilization, usage_hours as "usageHours", status, manager_user_id as "managerUserId"`,
    [
      id,
      patch.name ?? null,
      patch.model ?? null,
      patch.category ?? null,
      patch.group ?? null,
      patch.groupName ?? null,
      patch.location ?? null,
      patch.imageUrl ?? null,
      patch.features ? JSON.stringify(patch.features) : null,
      patch.usageConditions ?? null,
      patch.description ?? null,
      patch.vendorName ?? null,
      patch.vendorContactName ?? null,
      patch.vendorContactPosition ?? null,
      patch.vendorContactPhone ?? null,
      patch.utilization ?? null,
      patch.usageHours ?? null,
      patch.status ?? null,
      patch.managerUserId !== undefined || patch.managerId !== undefined,
      patch.managerUserId ?? patch.managerId ?? null
    ]
  );
  return result.rows[0] ? mapEquipment(result.rows[0]) : null;
}

export async function deleteEquipment(id: string) {
  if (!hasDatabase()) {
    const index = mutableFallbackEquipment.findIndex((entry) => entry.id === id);
    if (index === -1) return null;
    const [removed] = mutableFallbackEquipment.splice(index, 1);
    return removed;
  }

  const result = await query<EquipmentRow>(
    `update equipment
     set deleted_at = now(), updated_at = now()
     where id = $1 and deleted_at is null
     returning id, name, model, category, group_key as "group", group_name as "groupName",
       location, image_url as "imageUrl", features, usage_conditions as "usageConditions",
       description, vendor_name as "vendorName", vendor_contact_name as "vendorContactName",
       vendor_contact_position as "vendorContactPosition", vendor_contact_phone as "vendorContactPhone",
       utilization, usage_hours as "usageHours", status, manager_user_id as "managerUserId"`,
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
  if (!await canCreateReservation(body, user)) {
    throw new ReservationPermissionError();
  }
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

export async function updateReservationStatus(id: string, input: unknown, user: SessionUser) {
  const body = reservationStatusUpdateSchema.parse(input);
  if (!await canManageReservationStatus(id, user)) {
    throw new ReservationPermissionError();
  }

  if (!hasDatabase()) {
    const index = mutableFallbackReservations.findIndex((reservation) => reservation.id === id);
    if (index === -1) return null;
    mutableFallbackReservations[index] = {
      ...mutableFallbackReservations[index],
      status: body.status
    };
    return mutableFallbackReservations[index];
  }

  const result = await query<ReservationRow>(
    `update reservations
     set status = $2,
      deleted_at = case when $2 = 'canceled' then now() else deleted_at end,
      updated_at = now()
     where id = $1 and deleted_at is null
     returning id, equipment_id as "equipmentId", user_id as "userId", title, purpose,
       starts_at as "startsAt", ends_at as "endsAt", status, created_by_role as "createdByRole"`,
    [id, body.status]
  );
  return result.rows[0] ? mapReservation(result.rows[0]) : null;
}
