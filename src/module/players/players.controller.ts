import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiFailureDto, PlayersResponseDto } from '../../documentation/response.dto';
import { Public } from '../../auth/auth.decorators';
import { Controller, Get, HttpException, HttpStatus, Inject, Logger } from '@nestjs/common';
import { PlayersService } from './players.service';

@ApiTags('Players')
@Controller('api/players')
export class PlayersController {
  private readonly logger = new Logger(PlayersController.name);

  constructor(@Inject(PlayersService) private readonly service: PlayersService) {}

  @Public()
  @ApiOperation({ summary: 'List players with their teams', description: 'Public compatibility endpoint; returns the global list.' })
  @ApiResponse({ status: 200, type: PlayersResponseDto })
  @ApiResponse({ status: 500, description: 'Database query failed.', type: ApiFailureDto })
  @Get()
  async findAll() {
    try {
      const data = await this.service.findAll();
      return { success: true, message: 'Players fetched successfully', data };
    } catch (error) {
      this.logger.error('Error in getAllPlayers', error);
      throw new HttpException(
        { success: false, message: 'Internal server error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
