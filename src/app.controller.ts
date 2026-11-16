import { Public } from './auth/auth.decorators';
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Public()
  @Get()
  getRoot() {
    return 'Fantasy API is running';
  }
}
