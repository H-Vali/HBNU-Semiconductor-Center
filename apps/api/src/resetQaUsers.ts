import { closeDatabase, query, transaction } from './db.js';

type UserResetCounts = {
  users: number;
  adminUsers: number;
  userRoles: number;
  reservations: number;
  trainingRequests: number;
  equipmentPermissions: number;
  equipmentPermissionEvents: number;
  penaltyRecords: number;
  assignedEquipment: number;
};

function getConfiguredAdminEmails() {
  return new Set(
    [process.env.ADMIN_EMAILS, process.env.ADMIN_EMAIL]
      .filter(Boolean)
      .flatMap((value) => String(value).split(','))
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function getAdminUserIds() {
  const configuredAdminEmails = [...getConfiguredAdminEmails()];
  const result = await query<{ id: string }>(
    `select distinct u.id
     from users u
     left join user_roles ur on ur.user_id = u.id
     left join roles r on r.id = ur.role_id
     where u.deleted_at is null
       and (
         r.name = 'ADMIN'
         or lower(u.email) = any($1::text[])
       )`,
    [configuredAdminEmails]
  );
  return result.rows.map((row) => row.id);
}

async function countQaUsers(adminUserIds: string[]) {
  const result = await query<UserResetCounts>(
    `select
      (select count(*)::int from users where deleted_at is null and not (id = any($1::text[]))) as "users",
      (select count(*)::int from users where deleted_at is null and id = any($1::text[])) as "adminUsers",
      (select count(*)::int from user_roles where not (user_id = any($1::text[]))) as "userRoles",
      (select count(*)::int from reservations where deleted_at is null and user_id is not null and not (user_id = any($1::text[]))) as "reservations",
      (select count(*)::int from training_requests where deleted_at is null and not (applicant_user_id = any($1::text[]))) as "trainingRequests",
      (select count(*)::int from equipment_permissions where revoked_at is null and not (user_id = any($1::text[]))) as "equipmentPermissions",
      (select count(*)::int from equipment_permission_events where not (user_id = any($1::text[]))) as "equipmentPermissionEvents",
      (select count(*)::int from penalty_records where deleted_at is null and revoked_at is null and not (user_id = any($1::text[]))) as "penaltyRecords",
      (select count(*)::int from equipment where deleted_at is null and manager_user_id is not null and not (manager_user_id = any($1::text[]))) as "assignedEquipment"`,
    [adminUserIds]
  );
  return result.rows[0];
}

async function resetQaUsers() {
  if (process.env.CONFIRM_RESET_QA_USERS !== 'RESET') {
    throw new Error('Refusing to reset users. Set CONFIRM_RESET_QA_USERS=RESET to continue.');
  }

  const adminUserIds = await getAdminUserIds();
  if (adminUserIds.length === 0) {
    throw new Error('No active admin users found. Refusing to reset users.');
  }

  const before = await countQaUsers(adminUserIds);

  await transaction(async (client) => {
    const targetUsers = await client.query<{ id: string }>(
      `select id
       from users
       where deleted_at is null
         and not (id = any($1::text[]))`,
      [adminUserIds]
    );
    const targetUserIds = targetUsers.rows.map((row) => row.id);

    if (targetUserIds.length === 0) return;

    await client.query(
      `update reservations
       set status = 'canceled',
           deleted_at = now(),
           updated_at = now()
       where deleted_at is null
         and user_id = any($1::text[])`,
      [targetUserIds]
    );

    await client.query(
      `update training_requests
       set deleted_at = now(),
           updated_at = now(),
           handled_by = case when handled_by = any($1::text[]) then null else handled_by end
       where deleted_at is null
         and (
           applicant_user_id = any($1::text[])
           or handled_by = any($1::text[])
         )`,
      [targetUserIds]
    );

    await client.query(
      `update penalty_records
       set revoked_at = coalesce(revoked_at, now()),
           deleted_at = now(),
           updated_at = now()
       where deleted_at is null
         and user_id = any($1::text[])`,
      [targetUserIds]
    );

    await client.query(
      `update equipment
       set manager_user_id = null,
           updated_at = now()
       where manager_user_id = any($1::text[])`,
      [targetUserIds]
    );

    await client.query(`delete from equipment_permission_events where user_id = any($1::text[])`, [targetUserIds]);
    await client.query(
      `update equipment_permission_events
       set actor_id = null
       where actor_id = any($1::text[])`,
      [targetUserIds]
    );
    await client.query(`delete from equipment_permissions where user_id = any($1::text[])`, [targetUserIds]);
    await client.query(
      `update equipment_permissions
       set granted_by = case when granted_by = any($1::text[]) then null else granted_by end,
           revoked_by = case when revoked_by = any($1::text[]) then null else revoked_by end,
           updated_at = now()
       where granted_by = any($1::text[])
          or revoked_by = any($1::text[])`,
      [targetUserIds]
    );

    await client.query(`delete from user_roles where user_id = any($1::text[])`, [targetUserIds]);
    await client.query(
      `update audit_logs
       set actor_id = null
       where actor_id = any($1::text[])`,
      [targetUserIds]
    );
    await client.query(
      `update file_assets
       set created_by = null
       where created_by = any($1::text[])`,
      [targetUserIds]
    );

    await client.query(
      `update users
       set deleted_at = now(),
           updated_at = now()
       where id = any($1::text[])
         and deleted_at is null`,
      [targetUserIds]
    );
  });

  const after = await countQaUsers(adminUserIds);

  console.log(JSON.stringify({
    before,
    after,
    preservedAdminUsers: adminUserIds.length,
    note: 'QA users reset completed. Active admin users were preserved.'
  }, null, 2));
}

resetQaUsers()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void closeDatabase();
  });
