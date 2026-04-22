import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import 'dotenv/config'

export * from "./users";
export * from "./players";
export * from "./teams";
export * from "./matches";

import * as usersSchema from "./users";
import * as playersSchema from './players';
import * as teamsSchema from './teams';
import * as matchesSchema from './matches';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL env var required');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const schema = {
  ...usersSchema,
  ...playersSchema,
  ...teamsSchema,
  ...matchesSchema,
};


export const db = drizzle(pool, { schema });
export { pool };

export async function closeDb() {
  await pool.end();
}

