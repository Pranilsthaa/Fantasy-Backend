import { Public } from '../../auth/auth.decorators';
import { Controller, Get, HttpException, HttpStatus, Inject, Logger } from '@nestjs/common';
import { PlayersService } from './players.service';

@Controller('api/players')
export class PlayersController {
  private readonly logger = new Logger(PlayersController.name);

  constructor(@Inject(PlayersService) private readonly service: PlayersService) {}

  @Public()
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
