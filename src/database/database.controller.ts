import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DatabaseHealthDto, DatabaseUnavailableDto } from '../documentation/response.dto';
import { Public } from '../auth/auth.decorators';
import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DatabaseService } from './database.service';

@ApiTags('Health')
@Controller('health/database')
export class DatabaseController {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  @Public()
  @ApiOperation({ summary: 'Check database readiness', description: 'Runs a PostgreSQL query. No connection information or internal errors are returned.' })
  @ApiResponse({ status: 200, type: DatabaseHealthDto })
  @ApiResponse({ status: 503, type: DatabaseUnavailableDto })
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
