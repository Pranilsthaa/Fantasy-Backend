import { Body, Controller, Get, Header, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser, Public } from './auth.decorators';
import { authBody, LoginDto, RefreshTokenDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';
import { publicUser, type AuthenticatedUser } from './auth.types';

@Controller('api/auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  register(@Body(authBody(RegisterDto)) body: RegisterDto) {
    return this.auth.register(body);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  login(@Body(authBody(LoginDto)) body: LoginDto) {
    return this.auth.login(body);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  refresh(@Body(authBody(RefreshTokenDto)) body: RefreshTokenDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  logout(@Body(authBody(RefreshTokenDto)) body: RefreshTokenDto) {
    return this.auth.logout(body.refreshToken);
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user: publicUser(user) };
  }
}
