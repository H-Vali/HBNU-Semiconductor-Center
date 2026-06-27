import { closeDatabase, query, transaction } from './db.js';

type ResetCounts = {
  users: number;
  user_roles: number;
  equipment: number;
  assigned_equipment: number;
  reservations: number;
  training_requests: number;
  equipment_permissions: number;
  equipment_permission_events: number;
  notices: number;
  faqs: number;
  qna_items: number;
  penalty_records: number;
  file_assets: number;
  audit_logs: number;
  consumable_items: number;
};

const countSql = `
  select
    (select count(*)::int from users where deleted_at is null) as users,
    (select count(*)::int from user_roles) as user_roles,
    (select count(*)::int from equipment where deleted_at is null) as equipment,
    (select count(*)::int from equipment where deleted_at is null and manager_user_id is not null) as assigned_equipment,
    (select count(*)::int from reservations where deleted_at is null) as reservations,
    (select count(*)::int from training_requests where deleted_at is null) as training_requests,
    (select count(*)::int from equipment_permissions where revoked_at is null) as equipment_permissions,
    (select count(*)::int from equipment_permission_events) as equipment_permission_events,
    (select count(*)::int from notices where deleted_at is null) as notices,
    (select count(*)::int from faqs where deleted_at is null) as faqs,
    (select count(*)::int from qna_items where deleted_at is null) as qna_items,
    (select count(*)::int from penalty_records where deleted_at is null and revoked_at is null) as penalty_records,
    (select count(*)::int from file_assets where deleted_at is null) as file_assets,
    (select count(*)::int from audit_logs) as audit_logs,
    (select count(*)::int from consumable_items where deleted_at is null) as consumable_items
`;

async function countActiveData() {
  const result = await query<ResetCounts>(countSql);
  return result.rows[0];
}

async function resetQaData() {
  if (process.env.CONFIRM_RESET_QA_DATA !== 'RESET') {
    throw new Error('Refusing to reset data. Set CONFIRM_RESET_QA_DATA=RESET to continue.');
  }

  const before = await countActiveData();

  await transaction(async (client) => {
    await client.query(`
      update reservations
      set status = 'canceled',
          deleted_at = now(),
          updated_at = now()
      where deleted_at is null
    `);

    await client.query(`update training_requests set deleted_at = now(), updated_at = now() where deleted_at is null`);
    await client.query(`update notices set deleted_at = now(), updated_at = now() where deleted_at is null`);
    await client.query(`update faqs set deleted_at = now(), updated_at = now() where deleted_at is null`);
    await client.query(`update qna_items set deleted_at = now() where deleted_at is null`);
    await client.query(`update file_assets set deleted_at = now() where deleted_at is null`);
    await client.query(`
      update penalty_records
      set revoked_at = now(),
          deleted_at = now(),
          updated_at = now()
      where deleted_at is null
    `);

    await client.query(`delete from equipment_permission_events`);
    await client.query(`delete from equipment_permissions`);
    await client.query(`delete from user_roles`);
    await client.query(`delete from audit_logs`);

    await client.query(`update consumable_items set deleted_at = now(), updated_at = now() where deleted_at is null`);

    await client.query(`
      update equipment
      set manager_user_id = null,
          deleted_at = now(),
          updated_at = now()
      where deleted_at is null
    `);

    await client.query(`
      update users
      set deleted_at = now(),
          updated_at = now()
      where deleted_at is null
    `);
  });

  const after = await countActiveData();

  console.log(JSON.stringify({
    before,
    after,
    note: 'All active QA web data reset, including equipment. Schema and soft-deleted history preserved.'
  }, null, 2));
}

resetQaData()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void closeDatabase();
  });
