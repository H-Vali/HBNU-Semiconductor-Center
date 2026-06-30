import dotenv from 'dotenv';
import { initialFaqs, initialNotices, initialQnaItems } from './content.js';
import { auditLogSchemaStatements } from './auditLog.js';
import { closeDatabase, query } from './db.js';
import { equipment, reservations } from './data.js';
import { fileAssetSchemaStatements } from './fileAssets.js';
import { featureFlagSchemaStatements, hiddenFeatureKeys } from './features.js';
import { operationalDataSchemaStatements } from './operationalData.js';
import { initialUsers } from './usersSeed.js';

dotenv.config();

const statements = [
  `create extension if not exists btree_gist`,
  `create table if not exists roles (
    id text primary key,
    name text not null unique,
    description text not null default '',
    created_at timestamptz not null default now()
  )`,
  `create table if not exists role_permissions (
    role_id text not null references roles(id) on delete cascade,
    permission text not null,
    created_at timestamptz not null default now(),
    primary key (role_id, permission)
  )`,
  `create table if not exists users (
    id text primary key,
    email text not null unique,
    name text not null,
    auth_provider text not null default 'manual',
    google_subject text,
    department text,
    lab_professor text,
    phone text,
    memo text not null default '',
    role_level text not null default '일반',
    onboarding_status text not null default 'training_pending' check (onboarding_status in ('profile_pending', 'training_pending', 'active')),
    status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
  )`,
  `alter table users add column if not exists google_subject text`,
  `alter table users add column if not exists lab_professor text`,
  `alter table users add column if not exists memo text not null default ''`,
  `alter table users add column if not exists role_level text not null default '일반'`,
  `alter table users add column if not exists onboarding_status text not null default 'training_pending'`,
  `create index if not exists users_status_idx on users (status) where deleted_at is null`,
  `create unique index if not exists users_google_subject_key on users (google_subject) where google_subject is not null`,
  `create table if not exists user_roles (
    user_id text not null references users(id) on delete cascade,
    role_id text not null references roles(id) on delete restrict,
    granted_at timestamptz not null default now(),
    granted_by text references users(id),
    primary key (user_id, role_id)
  )`,
  `create table if not exists equipment (
    id text primary key,
    name text not null,
    model text,
    category text not null,
    group_key text not null default 'metrology',
    group_name text not null default '',
    location text not null default '',
    image_url text,
    features jsonb not null default '[]'::jsonb,
    usage_conditions text not null default '',
    description text,
    vendor_name text,
    vendor_contact_name text,
    vendor_contact_position text,
    vendor_contact_phone text,
    utilization integer not null default 0 check (utilization >= 0 and utilization <= 100),
    usage_hours integer not null default 0 check (usage_hours >= 0),
    status text not null default 'available' check (status in ('available', 'unavailable', 'maintenance')),
    manager_user_id text references users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
  )`,
  `alter table equipment add column if not exists model text`,
  `alter table equipment add column if not exists group_key text not null default 'metrology'`,
  `alter table equipment add column if not exists group_name text not null default ''`,
  `alter table equipment add column if not exists description text`,
  `alter table equipment add column if not exists vendor_name text`,
  `alter table equipment add column if not exists vendor_contact_name text`,
  `alter table equipment add column if not exists vendor_contact_position text`,
  `alter table equipment add column if not exists vendor_contact_phone text`,
  `alter table equipment add column if not exists usage_hours integer not null default 0`,
  `create index if not exists equipment_category_status_idx on equipment (category, status) where deleted_at is null`,
  `create table if not exists reservations (
    id text primary key,
    equipment_id text not null references equipment(id) on delete restrict,
    user_id text references users(id) on delete set null,
    title text not null,
    purpose text not null,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    status text not null default 'approved' check (status in ('approved', 'maintenance', 'external', 'canceled')),
    created_by_role text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    check (starts_at < ends_at)
  )`,
  `alter table reservations drop constraint if exists reservations_status_check`,
  `alter table reservations add constraint reservations_status_check check (status in ('approved', 'maintenance', 'external', 'canceled'))`,
  `create index if not exists reservations_equipment_time_idx on reservations (equipment_id, starts_at, ends_at) where deleted_at is null`,
  `create index if not exists reservations_user_time_idx on reservations (user_id, starts_at desc) where deleted_at is null`,
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
  `create index if not exists equipment_permission_events_equipment_idx on equipment_permission_events (equipment_id, created_at desc)`,
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
  `create index if not exists training_requests_requested_at_idx on training_requests (requested_at desc) where deleted_at is null`,
  `do $$
  begin
    if exists (
      select 1
      from pg_constraint
      where conname = 'reservations_no_equipment_time_overlap'
        and pg_get_constraintdef(oid) not ilike '%starts_at IS NOT NULL%'
    ) then
      alter table reservations drop constraint reservations_no_equipment_time_overlap;
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'reservations_no_equipment_time_overlap'
    ) then
      begin
        alter table reservations
          add constraint reservations_no_equipment_time_overlap
          exclude using gist (
            equipment_id with =,
            tstzrange(starts_at, ends_at, '[)') with &&
          )
          where (
            deleted_at is null
            and starts_at is not null
            and ends_at is not null
            and status in ('approved', 'maintenance', 'external')
          );
      exception
        when exclusion_violation then
          raise warning 'Skipped reservations overlap constraint because existing rows overlap';
      end;
    end if;
  end $$`,
  `create table if not exists notices (
    id text primary key,
    board text not null check (board in ('general', 'operation', 'meeting')),
    category text not null,
    title text not null,
    summary text not null default '',
    body text not null default '',
    author text not null default '관리자',
    notice_date text not null,
    views integer not null default 0,
    important boolean not null default false,
    pinned boolean not null default false,
    attachments jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
  )`,
  `create index if not exists notices_board_date_idx on notices (board, pinned desc, notice_date desc) where deleted_at is null`,
  `create table if not exists faqs (
    id text primary key,
    category text not null,
    question text not null,
    answer text not null,
    updated_at text not null,
    sort_order integer not null default 0,
    deleted_at timestamptz
  )`,
  `create index if not exists faqs_sort_idx on faqs (sort_order, id) where deleted_at is null`,
  `create table if not exists qna_items (
    id text primary key,
    department text not null,
    title text not null,
    content text not null default '',
    status text not null check (status in ('답변대기', '답변완료')),
    created_at text not null,
    answer text,
    answered_at text,
    answered_by text,
    deleted_at timestamptz
  )`,
  `create index if not exists qna_items_created_idx on qna_items (created_at desc) where deleted_at is null`,
  ...featureFlagSchemaStatements,
  ...operationalDataSchemaStatements,
  ...auditLogSchemaStatements,
  ...fileAssetSchemaStatements
];

const defaultRoles = [
  { id: 'role-user', name: 'USER', description: 'General equipment user' },
  { id: 'role-manager', name: 'MANAGER', description: 'Equipment manager' },
  { id: 'role-admin', name: 'ADMIN', description: 'System administrator' }
];

async function seedReferenceData() {
  for (const role of defaultRoles) {
    await query(
      `insert into roles (id, name, description)
       values ($1, $2, $3)
       on conflict (id) do update
       set name = excluded.name, description = excluded.description`,
      [role.id, role.name, role.description]
    );
  }

  for (const user of initialUsers) {
    const seededUser = await query<{ id: string }>(
      `insert into users (
        id, email, name, auth_provider, department, lab_professor, phone, memo,
        role_level, onboarding_status
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'training_pending')
      on conflict (email) do update
      set name = excluded.name,
          department = excluded.department,
          lab_professor = excluded.lab_professor,
          phone = excluded.phone,
          memo = excluded.memo,
          role_level = excluded.role_level,
          onboarding_status = case
            when users.onboarding_status = 'active' then users.onboarding_status
            else excluded.onboarding_status
          end,
          updated_at = now()
      returning id`,
      [
        user.id,
        user.email,
        user.name,
        user.authProvider,
        user.department,
        user.labProfessor,
        user.phone,
        user.memo,
        user.roleLevel
      ]
    );
    await query(
      `insert into user_roles (user_id, role_id)
       values ($1, 'role-user')
       on conflict (user_id, role_id) do nothing`,
      [seededUser.rows[0].id]
    );
  }

  for (const item of equipment) {
    await query(
      `insert into equipment (
        id, name, model, category, group_key, group_name, location, image_url, features,
        usage_conditions, description, vendor_name, vendor_contact_name, vendor_contact_position,
        vendor_contact_phone, utilization, usage_hours, status
      )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       on conflict (id) do update
       set name = excluded.name,
           model = excluded.model,
           category = excluded.category,
           group_key = excluded.group_key,
           group_name = excluded.group_name,
           location = excluded.location,
           image_url = excluded.image_url,
           features = excluded.features,
           usage_conditions = excluded.usage_conditions,
           description = excluded.description,
           vendor_name = excluded.vendor_name,
           vendor_contact_name = excluded.vendor_contact_name,
           vendor_contact_position = excluded.vendor_contact_position,
           vendor_contact_phone = excluded.vendor_contact_phone,
           utilization = excluded.utilization,
           usage_hours = excluded.usage_hours,
           status = excluded.status,
           updated_at = now()`,
      [
        item.id,
        item.name,
        item.model,
        item.category,
        item.group,
        item.groupName,
        item.location,
        item.imageUrl,
        JSON.stringify(item.features),
        item.usageConditions,
        item.description,
        item.vendorName,
        item.vendorContactName,
        item.vendorContactPosition,
        item.vendorContactPhone,
        item.utilization,
        item.usageHours,
        item.status
      ]
    );
  }

  await query(
    `update equipment
     set deleted_at = now(), updated_at = now()
     where id in ('eq-22', 'eq-23', 'eq-24')
       and deleted_at is null`
  );

  for (const reservation of reservations) {
    await query(
      `insert into reservations (id, equipment_id, title, purpose, starts_at, ends_at, status, created_by_role)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (id) do nothing`,
      [
        reservation.id,
        reservation.equipmentId,
        reservation.title,
        reservation.title,
        reservation.startsAt,
        reservation.endsAt,
        reservation.status,
        'SYSTEM'
      ]
    );
  }
}

async function seedContentData() {
  for (const notice of initialNotices) {
    await query(
      `insert into notices (
        id, board, category, title, summary, body, author, notice_date, views, important, pinned, attachments
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
      on conflict (id) do nothing`,
      [
        notice.id,
        notice.board,
        notice.category,
        notice.title,
        notice.summary,
        notice.body,
        notice.author,
        notice.date,
        notice.views,
        notice.important,
        notice.pinned,
        JSON.stringify(notice.attachments)
      ]
    );
  }

  for (const faq of initialFaqs) {
    await query(
      `insert into faqs (id, category, question, answer, updated_at, sort_order)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do nothing`,
      [faq.id, faq.category, faq.question, faq.answer, faq.updatedAt, faq.sortOrder]
    );
  }

  for (const item of initialQnaItems) {
    await query(
      `insert into qna_items (id, department, title, content, status, created_at, answer, answered_at, answered_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (id) do nothing`,
      [
        item.id,
        item.department,
        item.title,
        item.content,
        item.status,
        item.createdAt,
        item.answer ?? null,
        item.answeredAt ?? null,
        item.answeredBy ?? null
      ]
    );
  }
}

async function seedHiddenFeatureFlags() {
  for (const featureKey of hiddenFeatureKeys) {
    await query(
      `insert into feature_flags (feature_key, enabled)
       values ($1, false)
       on conflict (feature_key) do nothing`,
      [featureKey]
    );
  }
}

async function migrate() {
  for (const statement of statements) {
    await query(statement);
  }
  await seedHiddenFeatureFlags();
  await seedReferenceData();
  await seedContentData();
}

migrate()
  .then(async () => {
    console.log('Database migration completed');
    await closeDatabase();
  })
  .catch(async (error) => {
    console.error(error);
    await closeDatabase();
    process.exitCode = 1;
  });
