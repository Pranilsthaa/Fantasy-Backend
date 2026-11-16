import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { createDatabase } from './connection';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly connection = createDatabase();
  readonly db = this.connection.db;

  async onApplicationShutdown() {
    await this.connection.pool.end();
  }
}
