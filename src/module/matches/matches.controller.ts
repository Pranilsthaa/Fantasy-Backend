import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiFailureDto, MatchesResponseDto } from '../../documentation/response.dto';
import { Public } from '../../auth/auth.decorators';
import { Controller, Get, HttpException, HttpStatus, Inject, Logger } from '@nestjs/common';
import { MatchesService } from './matches.service';

@ApiTags('Matches')
@Controller('api/matches')
export class MatchesController {
  private readonly logger = new Logger(MatchesController.name);

  constructor(@Inject(MatchesService) private readonly service: MatchesService) {}

  @Public()
  @ApiOperation({ summary: 'List scheduled matches with both teams', description: 'Public compatibility endpoint; returns the global list.' })
  @ApiResponse({ status: 200, type: MatchesResponseDto })
  @ApiResponse({ status: 500, description: 'Database query failed.', type: ApiFailureDto })
  @Get()
  async findAll() {
    try {
      const data = await this.service.findAll();
      return { success: true, message: 'Matches fetched successfully', data };
    } catch (error) {
      this.logger.error('Error in getAllMatches', error);
      throw new HttpException(
        { success: false, message: 'Internal server error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
