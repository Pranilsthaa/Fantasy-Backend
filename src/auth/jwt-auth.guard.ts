import { type CanActivate, type ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_ROUTE } from './auth.decorators';
import { AuthRepository } from './auth.repository';
import { TokenService } from './token.service';
import { publicUser, type AuthRequest } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(AuthRepository) private readonly repository: AuthRepository,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const header = request.headers.authorization;
    const token = typeof header === 'string' && header.length <= 4096 ? /^Bearer ([^\s]+)$/i.exec(header)?.[1] : undefined;
    if (!token) throw new UnauthorizedException('Bearer access token required');
    const claims = await this.tokens.verifyAccess(token);
    const session = await this.repository.findActiveSession(claims.sessionId);
    if (!session || session.user.id !== claims.userId) throw new UnauthorizedException('Session expired or revoked');
    request.user = { ...publicUser(session.user), sessionId: session.id };
    return true;
  }
}
