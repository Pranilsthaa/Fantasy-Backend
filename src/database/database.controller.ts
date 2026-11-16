import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseService } from './database.service';

@Controller('health/database')
export class DatabaseController {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  @Get()
  async readiness() {
    try {
      await this.database.db.execute(sql`select 1`);
      return { status: 'ok', database: 'connected' };
    } catch {
      throw new HttpException({ status: 'error', database: 'unavailable' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
