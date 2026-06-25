import pg from 'pg';

const { Pool } = pg;
type QueryResultRow = pg.QueryResultRow;

export const databaseUrl = process.env.DATABASE_URL;

export const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    })
  : null;

export function hasDatabase() {
  return Boolean(pool);
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured');
  }
  return pool.query<T>(text, params);
}

export async function closeDatabase() {
  if (pool) await pool.end();
}
