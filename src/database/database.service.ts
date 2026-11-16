import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { schema } from '../db/schema';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly pool: Pool;
  readonly db;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL env var required');
    }
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    this.db = drizzle(this.pool, { schema });
  }

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
