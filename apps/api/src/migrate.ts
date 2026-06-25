import dotenv from 'dotenv';
import { closeDatabase, query } from './db.js';

dotenv.config();

const statements = [
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

async function migrate() {
  for (const statement of statements) {
    await query(statement);
  }
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
