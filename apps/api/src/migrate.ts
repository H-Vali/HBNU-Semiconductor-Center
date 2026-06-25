import dotenv from 'dotenv';
import { closeDatabase, query } from './db.js';
import { equipment } from './data.js';

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
    department text,
    phone text,
    status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
  )`,
  `create index if not exists users_status_idx on users (status) where deleted_at is null`,
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
    category text not null,
    location text not null default '',
    image_url text,
    features jsonb not null default '[]'::jsonb,
    usage_conditions text not null default '',
    utilization integer not null default 0 check (utilization >= 0 and utilization <= 100),
    status text not null default 'available' check (status in ('available', 'unavailable', 'maintenance')),
    manager_user_id text references users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
  )`,
  `create index if not exists equipment_category_status_idx on equipment (category, status) where deleted_at is null`,
  `create table if not exists reservations (
    id text primary key,
    equipment_id text not null references equipment(id) on delete restrict,
    user_id text references users(id) on delete set null,
    title text not null,
    purpose text not null,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    status text not null default 'pending' check (status in ('pending', 'approved', 'maintenance', 'external', 'canceled')),
    created_by_role text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    check (starts_at < ends_at)
  )`,
  `create index if not exists reservations_equipment_time_idx on reservations (equipment_id, starts_at, ends_at) where deleted_at is null`,
  `create index if not exists reservations_user_time_idx on reservations (user_id, starts_at desc) where deleted_at is null`,
  `do $$
  begin
    if not exists (
      select 1 from pg_constraint where conname = 'reservations_no_equipment_time_overlap'
    ) then
      alter table reservations
        add constraint reservations_no_equipment_time_overlap
        exclude using gist (
          equipment_id with =,
          tstzrange(starts_at, ends_at, '[)') with &&
        )
        where (deleted_at is null and status in ('pending', 'approved', 'maintenance', 'external'));
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
  `create index if not exists qna_items_created_idx on qna_items (created_at desc) where deleted_at is null`
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

  for (const item of equipment) {
    await query(
      `insert into equipment (id, name, category, location, image_url, features, usage_conditions, utilization)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       on conflict (id) do update
       set name = excluded.name,
           category = excluded.category,
           location = excluded.location,
           image_url = excluded.image_url,
           features = excluded.features,
           usage_conditions = excluded.usage_conditions,
           utilization = excluded.utilization,
           updated_at = now()`,
      [
        item.id,
        item.name,
        item.category,
        item.location,
        item.imageUrl,
        JSON.stringify(item.features),
        item.usageConditions,
        item.utilization
      ]
    );
  }
}

async function migrate() {
  for (const statement of statements) {
    await query(statement);
  }
  await seedReferenceData();
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
