import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { schema } from '../db/schema';
import { databaseUrl } from './environment';

export function createDatabase() {
  const pool = new Pool({
    connectionString: databaseUrl(),
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    statement_timeout: 15_000,
    query_timeout: 20_000,
    keepAlive: true,
    maxLifetimeSeconds: 300,
  });
  // Idle connection errors are emitted outside request promise handlers.
  pool.on('error', (error: NodeJS.ErrnoException) => {
    console.error('Idle PostgreSQL connection failed', { code: error.code ?? 'UNKNOWN' });
  });
  return { pool, db: drizzle(pool, { schema }) };
}
