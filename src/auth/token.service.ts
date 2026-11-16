import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';
import { REFRESH_PATTERN, UUID_PATTERN } from './auth.dto';

@Injectable()
export class TokenService {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  access(userId: string, sessionId: string) {
    return this.jwt.signAsync({ sub: userId, sid: sessionId, tokenUse: 'access' }, {
      secret: this.config.secret,
      algorithm: 'HS256',
      jwtid: randomUUID(),
      issuer: this.config.issuer,
      audience: this.config.audience,
      expiresIn: this.config.accessTtlSeconds,
    });
  }

  async verifyAccess(token: string) {
    try {
      const claims = await this.jwt.verifyAsync<Record<string, unknown>>(token, {
        secret: this.config.secret, algorithms: ['HS256'],
        issuer: this.config.issuer, audience: this.config.audience,
      });
      if (typeof claims.sub !== 'string' || !UUID_PATTERN.test(claims.sub)
        || typeof claims.sid !== 'string' || !UUID_PATTERN.test(claims.sid)
        || claims.tokenUse !== 'access' || typeof claims.exp !== 'number'
        || typeof claims.iat !== 'number' || !Number.isSafeInteger(claims.exp)
        || !Number.isSafeInteger(claims.iat) || claims.exp <= claims.iat
        || claims.exp - claims.iat > this.config.accessTtlSeconds
        || claims.iat > Math.floor(Date.now() / 1000)) throw new Error('Invalid claims');
      return { userId: claims.sub, sessionId: claims.sid };
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  refresh(sessionId: string) {
    return `${sessionId}.${randomBytes(32).toString('hex')}`;
  }

  refreshSessionId(token: string) {
    if (!REFRESH_PATTERN.test(token)) throw new UnauthorizedException('Invalid refresh token');
    return token.slice(0, 36);
  }

  hashRefresh(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
