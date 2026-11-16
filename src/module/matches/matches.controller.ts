import { Public } from '../../auth/auth.decorators';
import { Controller, Get, HttpException, HttpStatus, Inject, Logger } from '@nestjs/common';
import { MatchesService } from './matches.service';

@Controller('api/matches')
export class MatchesController {
  private readonly logger = new Logger(MatchesController.name);

  constructor(@Inject(MatchesService) private readonly service: MatchesService) {}

  @Public()
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
