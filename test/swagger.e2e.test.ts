import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { OpenAPIObject, SchemaObject } from '@nestjs/swagger';
import { randomBytes } from 'node:crypto';
import { AUTH_CONFIG } from '../src/auth/auth.config';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import { setupApiDocumentation } from '../src/documentation/swagger';

describe('Swagger documentation in Bun source mode', () => {
  let app: INestApplication;
  let origin: string;
  let document: OpenAPIObject;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_CONFIG).useValue({ secret: randomBytes(48).toString('base64url'), issuer: 'test-api', audience: 'test-client', accessTtlSeconds: 900, sessionTtlSeconds: 604800 })
      .overrideProvider(DatabaseService).useValue({ db: {} })
      .compile();
    app = module.createNestApplication({ logger: false });
    document = setupApiDocumentation(app);
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });
  afterAll(async () => { await app?.close(); });

  it('serves the UI, local assets and JSON without a bearer token', async () => {
    const ui = await fetch(`${origin}/api/docs`);
    expect(ui.status).toBe(200);
    expect(await ui.text()).toContain('Local Fantasy API Documentation');
    const asset = await fetch(`${origin}/api/docs/swagger-ui-bundle.js`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get('content-type')).toContain('javascript');
    const json = await fetch(`${origin}/api/docs-json`);
    expect(json.status).toBe(200);
    expect((await json.json() as OpenAPIObject).info.title).toBe('Local Fantasy API');
  });

  it('documents every currently implemented operation with responses', () => {
    const expected = ['/', '/health/database', '/api/players', '/api/matches', '/api/auth/register', '/api/auth/login', '/api/auth/refresh', '/api/auth/logout', '/api/auth/me', '/api/leagues', '/api/leagues/{leagueId}', '/api/leagues/{leagueId}/staff', '/api/leagues/{leagueId}/staff/{userId}', '/api/leagues/{leagueId}/tournaments', '/api/leagues/{leagueId}/tournaments/{tournamentId}', '/api/leagues/{leagueId}/teams', '/api/leagues/{leagueId}/teams/{teamId}', '/api/leagues/{leagueId}/players', '/api/leagues/{leagueId}/players/{playerId}', '/api/leagues/{leagueId}/tournaments/{tournamentId}/teams', '/api/leagues/{leagueId}/tournaments/{tournamentId}/teams/{teamId}', '/api/leagues/{leagueId}/tournaments/{tournamentId}/players', '/api/leagues/{leagueId}/tournaments/{tournamentId}/players/{playerId}', '/api/leagues/{leagueId}/tournaments/{tournamentId}/schedule', '/api/leagues/{leagueId}/tournaments/{tournamentId}/schedule/fixtures', '/api/leagues/{leagueId}/tournaments/{tournamentId}/schedule/fixtures/{fixtureId}', '/api/leagues/{leagueId}/tournaments/{tournamentId}/schedule/fixtures/{fixtureId}/status', '/api/leagues/{leagueId}/tournaments/{tournamentId}/schedule/publish', '/api/tournaments/{tournamentId}/schedule', '/api/leagues/{leagueId}/tournaments/{tournamentId}/schedule/fixtures/{fixtureId}/scorecard', '/api/leagues/{leagueId}/tournaments/{tournamentId}/schedule/fixtures/{fixtureId}/scorecard/lineups', '/api/leagues/{leagueId}/tournaments/{tournamentId}/schedule/fixtures/{fixtureId}/scorecard/innings', '/api/leagues/{leagueId}/tournaments/{tournamentId}/schedule/fixtures/{fixtureId}/scorecard/bowler', '/api/leagues/{leagueId}/tournaments/{tournamentId}/schedule/fixtures/{fixtureId}/scorecard/batter', '/api/leagues/{leagueId}/tournaments/{tournamentId}/schedule/fixtures/{fixtureId}/scorecard/deliveries', '/api/leagues/{leagueId}/tournaments/{tournamentId}/schedule/fixtures/{fixtureId}/scorecard/undo', '/api/leagues/{leagueId}/tournaments/{tournamentId}/schedule/fixtures/{fixtureId}/scorecard/correction', '/api/leagues/{leagueId}/tournaments/{tournamentId}/schedule/fixtures/{fixtureId}/scorecard/publish', '/api/tournaments/{tournamentId}/fixtures/{fixtureId}/scorecard', '/api/tournaments/{tournamentId}/reports/results', '/api/tournaments/{tournamentId}/reports/standings', '/api/tournaments/{tournamentId}/reports/players'];
    expect(Object.keys(document.paths).sort()).toEqual(expected.sort());
    expect(document.paths['/api/auth/register']?.post?.responses['201']).toBeDefined();
    expect(document.paths['/api/auth/logout']?.post?.responses['204']).toBeDefined();
    expect(document.paths['/api/auth/login']?.post?.responses['401']).toBeDefined();
    expect(document.paths['/health/database']?.get?.responses['503']).toBeDefined();
  });

  it('retains explicit request schemas without emitted decorator type metadata', () => {
    for (const [route, name] of [['register', 'RegisterDto'], ['login', 'LoginDto'], ['refresh', 'RefreshTokenDto'], ['logout', 'RefreshTokenDto']]) {
      const body = document.paths[`/api/auth/${route}`]?.post?.requestBody;
      expect(body && !('$ref' in body) && body.content['application/json']?.schema).toEqual({ $ref: `#/components/schemas/${name}` });
    }
    const schema = document.components?.schemas?.RegisterDto as SchemaObject;
    expect(schema.required?.sort()).toEqual(['email', 'password', 'username']);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties?.password).toMatchObject({ type: 'string', minLength: 8, maxLength: 128, writeOnly: true });
  });

  it('marks profile access as JWT-protected and public endpoints as unauthenticated', async () => {
    expect(document.components?.securitySchemes?.['access-token']).toMatchObject({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
    expect(document.paths['/api/auth/me']?.get?.security).toEqual([{ 'access-token': [] }]);
    for (const route of ['/api/auth/register', '/api/auth/login', '/api/auth/refresh', '/api/auth/logout']) {
      expect(document.paths[route]?.post?.security ?? []).toEqual([]);
    }
    expect(document.paths['/api/matches']?.get?.security ?? []).toEqual([]);
    expect((await fetch(`${origin}/api/auth/me`)).status).toBe(401);
  });

  it('declares every templated UUID parameter and protects league operations', () => {
    for (const [path, methods] of Object.entries(document.paths)) {
      if (!path.startsWith('/api/leagues')) continue;
      for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
        const operation = methods[method];
        if (!operation) continue;
        expect(operation.security).toEqual([{ 'access-token': [] }]);
        for (const match of path.matchAll(/\{(\w+)\}/g)) {
          expect(operation.parameters).toContainEqual({ name: match[1]!, in: 'path', required: true, schema: { type: 'string', format: 'uuid' } });
        }
      }
    }
  });

  it('documents safe nested response projections and excludes persistence secrets', () => {
    const schemas = document.components?.schemas;
    const user = schemas?.PublicUserDto as SchemaObject;
    expect(Object.keys(user.properties ?? {}).sort()).toEqual(['createdAt', 'email', 'id', 'role', 'username']);
    const players = schemas?.PlayersResponseDto as SchemaObject;
    expect(players.properties?.data).toMatchObject({ type: 'array', items: { $ref: '#/components/schemas/PlayerSummaryDto' } });
    const match = schemas?.MatchSummaryDto as SchemaObject;
    expect(match.properties?.team1).toBeDefined();
    expect(match.properties?.team2).toBeDefined();
    expect(JSON.stringify(document)).not.toMatch(/passwordHash|password_hash|refreshTokenHash|refresh_token_hash|JWT_SECRET|DATABASE_URL/);
  });
});
