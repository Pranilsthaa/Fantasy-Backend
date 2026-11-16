import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { randomBytes, randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { AUTH_CONFIG, loadAuthConfig, type AuthConfig } from '../src/auth/auth.config';
import { AuthRepository } from '../src/auth/auth.repository';
import { DatabaseService } from '../src/database/database.service';
import type { User } from '../src/db/users';

const config: AuthConfig = { secret: randomBytes(48).toString('base64url'), issuer: 'test-api', audience: 'test-client', accessTtlSeconds: 900, sessionTtlSeconds: 604800 };
const password = 'Only-for-auth-test-123';
type Session = { id: string; userId: string; refreshTokenHash: string; expiresAt: Date; revokedAt: Date | null };

// Substitute the persistence boundary only. Exercise real validation, Argon2id,
// JWT signing/verification, global guards and HTTP responses.
class MemoryAuthRepository {
  users = new Map<string, User>();
  sessions = new Map<string, Session>();
  async createUser(username: string, email: string, passwordHash: string) {
    if ([...this.users.values()].some((u) => u.username.toLowerCase() === username || u.email.toLowerCase() === email)) {
      throw Object.assign(new Error('duplicate'), { cause: { code: '23505' } });
    }
    const user: User = { id: randomUUID(), username, email, passwordHash, role: 'user', createdAt: new Date(), updatedAt: new Date() };
    this.users.set(user.id, user);
    return user;
  }
  async findByEmail(email: string) { return [...this.users.values()].find((u) => u.email.toLowerCase() === email); }
  async createSession(session: Omit<Session, 'revokedAt'>) { this.sessions.set(session.id, { ...session, revokedAt: null }); }
  async findActiveSession(id: string) {
    const session = this.sessions.get(id);
    const user = session && this.users.get(session.userId);
    if (!session || !user || session.revokedAt || session.expiresAt <= new Date()) return undefined;
    return { ...session, user };
  }
  async rotateSession(id: string, oldHash: string, newHash: string) {
    const session = this.sessions.get(id);
    if (!session || session.refreshTokenHash !== oldHash || session.revokedAt || session.expiresAt <= new Date()) return undefined;
    session.refreshTokenHash = newHash;
    return { id };
  }
  async revokeSession(id: string, hash: string) {
    const session = this.sessions.get(id);
    if (session && session.refreshTokenHash === hash) session.revokedAt = new Date();
  }
}

@Controller('api/test/private')
class PrivateController { @Get() read() { return { allowed: true }; } }

interface Tokens {
  user: { id: string; username: string; email: string; role: string };
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  refreshExpiresAt: string;
}

describe('JWT authentication over HTTP', () => {
  let app: INestApplication, origin: string;
  const repository = new MemoryAuthRepository();
  const jwt = new JwtService();
  const post = (path: string, body: unknown) => fetch(`${origin}/api/auth/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const me = (token?: string) => fetch(`${origin}/api/auth/me`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  const register = async () => {
    const response = await post('register', { username: 'manager', email: 'manager@example.invalid', password });
    expect(response.status).toBe(201);
    return await response.json() as Tokens;
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule], controllers: [PrivateController] })
      .overrideProvider(DatabaseService).useValue({ db: {} })
      .overrideProvider(AUTH_CONFIG).useValue(config)
      .overrideProvider(AuthRepository).useValue(repository)
      .overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });
  beforeEach(() => { repository.users.clear(); repository.sessions.clear(); });
  afterAll(async () => { await app?.close(); });

  it('registers a regular user, hashes credentials and excludes private fields', async () => {
    const response = await post('register', { username: ' Manager ', email: ' Manager@Example.Invalid ', password });
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json() as Tokens;
    expect(body.user).toMatchObject({ username: 'manager', email: 'manager@example.invalid', role: 'user' });
    expect(body.expiresIn).toBe(900);
    expect(body.tokenType).toBe('Bearer');
    expect(Object.keys(body.user).sort()).toEqual(['createdAt', 'email', 'id', 'role', 'username']);
    const stored = repository.users.get(body.user.id)!;
    expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(await Bun.password.verify(password, stored.passwordHash)).toBe(true);
    const [session] = repository.sessions.values();
    expect(session?.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(session?.refreshTokenHash).not.toBe(body.refreshToken);
    expect((await me(body.accessToken)).status).toBe(200);
  });

  it('logs in using a normalized email and returns an allow-listed profile', async () => {
    await register();
    const response = await post('login', { email: ' MANAGER@EXAMPLE.INVALID ', password });
    expect(response.status).toBe(200);
    const tokens = await response.json() as Tokens;
    const profile = await me(tokens.accessToken);
    expect(profile.status).toBe(200);
    expect(Object.keys((await profile.json() as Tokens).user).sort()).toEqual(['createdAt', 'email', 'id', 'role', 'username']);
  });

  it('returns generic duplicate-account conflicts', async () => {
    await register();
    const response = await post('register', { username: 'other', email: 'MANAGER@example.invalid', password });
    expect(response.status).toBe(409);
    expect((await response.json() as { message: string }).message).toBe('An account with these details already exists');
  });

  it('rejects case-insensitive duplicate usernames', async () => {
    await register();
    expect((await post('register', { username: 'MANAGER', email: 'other@example.invalid', password })).status).toBe(409);
  });

  for (const input of [
    { username: 'manager', email: 'bad', password },
    { username: 'manager', email: 'manager@example.invalid', password: 'short' },
    { username: 'manager', email: 'manager@example.invalid', password, role: 'admin' },
    { username: 'manager', email: 'manager@example.invalid', password, passwordHash: 'injected' },
    { username: ['manager'], email: 'manager@example.invalid', password },
    { username: 'manager', email: 'manager@example.invalid', password: 'x'.repeat(129) },
  ]) {
    it(`rejects malformed or unexpected registration input (${Object.keys(input).join(',')}, ${typeof input.password})`, async () => {
      expect((await post('register', input)).status).toBe(400);
      expect(repository.users.size).toBe(0);
    });
  }

  it('gives the same failure for unknown email and incorrect password', async () => {
    await register();
    const unknown = await post('login', { email: 'unknown@example.invalid', password });
    const wrong = await post('login', { email: 'manager@example.invalid', password: 'Incorrect-password-123' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(await unknown.json()).toEqual(await wrong.json());
  });

  it('does not accept legacy seed password placeholders as real passwords', async () => {
    const tokens = await register();
    repository.users.get(tokens.user.id)!.passwordHash = 'hashed_password_123';
    expect((await post('login', { email: tokens.user.email, password: 'hashed_password_123' })).status).toBe(401);
  });

  it('requires a bearer token on profile and newly added private routes', async () => {
    expect((await me()).status).toBe(401);
    expect((await fetch(`${origin}/api/test/private`)).status).toBe(401);
    const tokens = await register();
    expect((await fetch(`${origin}/api/test/private`, { headers: { authorization: `Bearer ${tokens.accessToken}` } })).status).toBe(200);
  });

  it('rejects malformed and tampered tokens and refresh tokens used as access tokens', async () => {
    const tokens = await register();
    expect((await me('not-a-jwt')).status).toBe(401);
    expect((await me(`${tokens.accessToken}tampered`)).status).toBe(401);
    expect((await me(tokens.refreshToken)).status).toBe(401);
  });

  for (const scenario of ['expired', 'issuer', 'audience', 'algorithm', 'missing-expiry', 'wrong-purpose', 'subject', 'future-issuance', 'lifetime'] as const) {
    it(`rejects a signed token with invalid ${scenario}`, async () => {
      const tokens = await register();
      const claims = jwt.decode(tokens.accessToken) as { sub: string; sid: string };
      const payload: Record<string, unknown> = { sub: claims.sub, sid: claims.sid, tokenUse: 'access' };
      if (scenario === 'wrong-purpose') payload.tokenUse = 'refresh';
      if (scenario === 'subject') payload.sub = randomUUID();
      if (scenario === 'future-issuance') payload.iat = Math.floor(Date.now() / 1000) + 600;
      const signed = await jwt.signAsync(payload, {
        secret: config.secret,
        issuer: scenario === 'issuer' ? 'other-api' : config.issuer,
        audience: scenario === 'audience' ? 'other-client' : config.audience,
        algorithm: scenario === 'algorithm' ? 'HS384' : 'HS256',
        ...(scenario === 'missing-expiry' ? {} : { expiresIn: scenario === 'expired' ? -1 : scenario === 'lifetime' ? 1800 : 900 }),
      });
      expect((await me(signed)).status).toBe(401);
    });
  }

  it('reads the current role from persistence rather than trusting a stale claim', async () => {
    const tokens = await register();
    repository.users.get(tokens.user.id)!.role = 'admin';
    const profile = await me(tokens.accessToken);
    expect((await profile.json() as Tokens).user.role).toBe('admin');
  });

  it('rotates refresh tokens and rejects reuse without extending session expiry', async () => {
    const tokens = await register();
    const response = await post('refresh', { refreshToken: tokens.refreshToken });
    expect(response.status).toBe(200);
    const next = await response.json() as Tokens;
    expect(next.refreshToken).not.toBe(tokens.refreshToken);
    expect(next.accessToken).not.toBe(tokens.accessToken);
    expect(next.refreshExpiresAt).toBe(tokens.refreshExpiresAt);
    expect((await me(next.accessToken)).status).toBe(200);
    expect((await post('refresh', { refreshToken: tokens.refreshToken })).status).toBe(401);
  });

  it('allows only one concurrent refresh of the same credential', async () => {
    const tokens = await register();
    const responses = await Promise.all([post('refresh', { refreshToken: tokens.refreshToken }), post('refresh', { refreshToken: tokens.refreshToken })]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 401]);
  });

  it('revokes access and refresh credentials on logout and permits repeat logout', async () => {
    const tokens = await register();
    expect((await post('logout', { refreshToken: tokens.refreshToken })).status).toBe(204);
    expect((await post('logout', { refreshToken: tokens.refreshToken })).status).toBe(204);
    expect((await me(tokens.accessToken)).status).toBe(401);
    expect((await post('refresh', { refreshToken: tokens.refreshToken })).status).toBe(401);
  });

  it('rejects expired database sessions even while the access token is valid', async () => {
    const tokens = await register();
    const [session] = repository.sessions.values();
    session!.expiresAt = new Date(Date.now() - 1000);
    expect((await me(tokens.accessToken)).status).toBe(401);
    expect((await post('refresh', { refreshToken: tokens.refreshToken })).status).toBe(401);
  });

  it('rejects invalid and unknown refresh credentials', async () => {
    expect((await post('refresh', { refreshToken: 'bad' })).status).toBe(400);
    expect((await post('refresh', { refreshToken: `${randomUUID()}.${randomBytes(32).toString('hex')}` })).status).toBe(401);
  });
});

describe('Authentication rate limiting', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService).useValue({ db: {} })
      .overrideProvider(AUTH_CONFIG).useValue(config).compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => { await app?.close(); });
  it('limits registration attempts before expensive credential processing', async () => {
    const origin = await app.getUrl();
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await fetch(`${origin}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      expect(response.status).toBe(400);
    }
    const response = await fetch(`${origin}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).not.toBeNull();
  });
});

it('rejects missing or weak JWT signing configuration', () => {
  const previous = process.env.JWT_SECRET;
  try {
    delete process.env.JWT_SECRET;
    expect(() => loadAuthConfig()).toThrow('JWT_SECRET');
    process.env.JWT_SECRET = 'short';
    expect(() => loadAuthConfig()).toThrow('JWT_SECRET');
    process.env.JWT_SECRET = 'x'.repeat(48);
    expect(() => loadAuthConfig()).toThrow('JWT_SECRET');
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
});
