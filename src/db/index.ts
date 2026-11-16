import { createDatabase } from '../database/connection';

export * from './schema';

// Standalone scripts only; Nest owns its separate injectable connection.
export const { db, pool } = createDatabase();

export async function closeDb() {
  await pool.end();
}
