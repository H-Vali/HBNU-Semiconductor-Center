import { hasDatabase, query } from './db.js';
import { listEquipment, listReservations } from './core.js';
import { listTrainingRequests } from './training.js';
import { listUsers } from './users.js';

export type AdminSummary = {
  users: number;
  pendingReservations: number;
  educationRequests: number;
  equipmentOnline: number;
};

function countRows(result: { rows: { count: string }[] }) {
  return Number(result.rows[0]?.count ?? 0);
}

export async function getAdminSummary(): Promise<AdminSummary> {
  if (!hasDatabase()) {
    const [users, reservations, equipment, trainingRequests] = await Promise.all([
      listUsers(),
      listReservations(),
      listEquipment(),
      listTrainingRequests({ id: 'admin-summary', name: 'Admin Summary', email: '', role: 'ADMIN' }, {})
    ]);

    return {
      users: users.length,
      pendingReservations: reservations.filter((item) => item.status === 'pending').length,
      educationRequests: trainingRequests.filter((item) => item.status === 'requested' || item.status === 'scheduled').length,
      equipmentOnline: equipment.filter((item) => item.status === 'available').length
    };
  }

  const [users, pendingReservations, educationRequests, equipmentOnline] = await Promise.all([
    query<{ count: string }>('select count(*)::text as count from users where deleted_at is null'),
    query<{ count: string }>(
      "select count(*)::text as count from reservations where deleted_at is null and status = 'pending'"
    ),
    query<{ count: string }>(
      "select count(*)::text as count from training_requests where deleted_at is null and status in ('requested', 'scheduled')"
    ),
    query<{ count: string }>(
      "select count(*)::text as count from equipment where deleted_at is null and status = 'available'"
    )
  ]);

  return {
    users: countRows(users),
    pendingReservations: countRows(pendingReservations),
    educationRequests: countRows(educationRequests),
    equipmentOnline: countRows(equipmentOnline)
  };
}
