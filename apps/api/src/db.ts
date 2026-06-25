import pg from 'pg';

const { Pool } = pg;
type PoolClient = pg.PoolClient;
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

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>) {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured');
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await callback(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  if (pool) await pool.end();
}
