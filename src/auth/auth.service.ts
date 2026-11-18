import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AUTH_CONFIG, type AuthConfig } from "./auth.config";
import { type LoginDto, type RegisterDto } from "./auth.dto";
import { AuthRepository } from "./auth.repository";
import { publicUser, type PublicUser } from "./auth.types";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";

@Injectable()
export class AuthService {
  constructor(
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async register(input: RegisterDto) {
    const passwordHash = await this.passwords.hash(input.password);
    let user: PublicUser;
    try {
      user = await this.repository.createUser(
        input.username,
        input.email,
        passwordHash,
      );
    } catch (error) {
      const failure = error as { code?: string; cause?: { code?: string } };
      if ((failure.cause?.code ?? failure.code) === "23505") {
        throw new ConflictException(
          "An account with these details already exists",
        );
      }
      throw error;
    }
    return this.newSession(user);
  }

  async login(input: LoginDto) {
    const user = await this.repository.findByEmail(input.email);
    const matches = await this.passwords.verify(
      input.password,
      user?.passwordHash,
    );
    if (!user || !matches)
      throw new UnauthorizedException("Invalid email or password");
    return this.newSession(user);
  }

  private async newSession(user: PublicUser) {
    const sessionId = randomUUID();
    const refreshToken = this.tokens.refresh(sessionId);
    const expiresAt = new Date(
      Date.now() + this.config.sessionTtlSeconds * 1000,
    );
    const accessToken = await this.tokens.access(user.id, sessionId);
    await this.repository.createSession({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: this.tokens.hashRefresh(refreshToken),
      expiresAt,
    });
    return this.response(user, accessToken, refreshToken, expiresAt);
  }

  async refresh(refreshToken: string) {
    const id = this.tokens.refreshSessionId(refreshToken);
    const rotatedToken = this.tokens.refresh(id);
    const rotated = await this.repository.rotateSession(
      id,
      this.tokens.hashRefresh(refreshToken),
      this.tokens.hashRefresh(rotatedToken),
    );
    if (!rotated)
      throw new UnauthorizedException("Invalid or expired refresh token");
    const session = await this.repository.findActiveSession(id);
    if (!session)
      throw new UnauthorizedException("Invalid or expired refresh  token");
    const accessToken = await this.tokens.access(session.user.id, session.id);
    return this.response(
      session.user,
      accessToken,
      rotatedToken,
      session.expiresAt,
    );
  }

  async logout(refreshToken: string) {
    const id = this.tokens.refreshSessionId(refreshToken);
    await this.repository.revokeSession(
      id,
      this.tokens.hashRefresh(refreshToken),
    );
  }

  private response(
    user: PublicUser,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date,
  ) {
    return {
      user: publicUser(user),
      tokenType: "Bearer" as const,
      accessToken,
      expiresIn: this.config.accessTtlSeconds,
      refreshToken,
      refreshExpiresAt: expiresAt.toISOString(),
    };
  }
}
