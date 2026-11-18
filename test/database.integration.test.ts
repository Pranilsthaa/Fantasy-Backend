import 'reflect-metadata';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool, type PoolClient } from 'pg';
import { connectionString } from '../src/database/environment';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import * as tables from '../src/db/schema';

// Explicit opt-in on an isolated Neon branch. Never fall back to DATABASE_URL.
const testUrl = process.env.TEST_DATABASE_URL;
const enabled = Boolean(testUrl && process.env.TEST_NEON_BRANCH?.startsWith('schema-check-'));

describe.skipIf(!enabled)('PostgreSQL migration and fantasy schema', () => {
  let pool: Pool;
  let client: PoolClient;
  let app: INestApplication;
  let origin: string;
  let tempMigrations: string;
  let transactionStarted = false;
  const originalUrl = process.env.DATABASE_URL;
  const originalSecret = process.env.JWT_SECRET;
  const id = () => crypto.randomUUID();
  const userId = id(), teamA = id(), teamB = id(), playerA = id(), playerB = id();
  const legacyMatch = id(), league = id(), tournament = id(), otherTournament = id();
  const round1 = id(), round2 = id(), otherRound = id(), match = id();
  const rosterA = id(), rosterB = id(), otherRoster = id();
  const rules = id(), fantasy = id(), entry = id(), squad = id(), laterSquad = id();
  const revision = id(), metric = id(), run = id();

  beforeAll(async () => {
    if (!testUrl || new URL(testUrl).hostname === new URL(originalUrl ?? testUrl).hostname) {
      throw new Error('TEST_DATABASE_URL must point to a different database branch from the application');
    }
    if (new URL(testUrl).hostname.includes('-pooler')) throw new Error('Use a direct test connection for migrations');
    pool = new Pool({ connectionString: connectionString(testUrl), max: 3, connectionTimeoutMillis: 15000 });
    const db = drizzle(pool, { schema: tables });
    // Upgrade rehearsal: install the previous schema, insert legacy rows, then
    // apply the expansion. This catches failures hidden by an empty DB test.
    const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'));
    tempMigrations = mkdtempSync(join(tmpdir(), 'fantasy-migration-'));
    mkdirSync(join(tempMigrations, 'meta'));
    const previous = { ...journal, entries: journal.entries.filter((e: { idx: number }) => e.idx < 4) };
    writeFileSync(join(tempMigrations, 'meta/_journal.json'), JSON.stringify(previous));
    for (const item of previous.entries) copyFileSync(`drizzle/${item.tag}.sql`, join(tempMigrations, `${item.tag}.sql`));
    await migrate(db, { migrationsFolder: tempMigrations });
    await db.insert(tables.users).values({ id: userId, username: `test-${userId}`, email: `${userId}@example.invalid`, passwordHash: 'test-only' });
    await pool.query(
      'insert into teams (id,code,name,logo) values ($1,$2,$3,$4),($5,$6,$7,$8)',
      [teamA, teamA.slice(0, 5), `A-${teamA}`, 'a.png', teamB, teamB.slice(0, 5), `B-${teamB}`, 'b.png'],
    );
    await pool.query(
      'insert into players (id,team_id,name,role,price) values ($1,$2,$3,$4,$5),($6,$7,$8,$9,$10)',
      [playerA, teamA, 'Verified player A', 'BAT', 10, playerB, teamB, 'Verified player B', 'BWL', 9],
    );
    await pool.query('insert into matches (id, match_number, team1_id, team2_id, venue, date) values ($1, $2, $3, $4, $5, now())', [legacyMatch, 900001, teamA, teamB, 'Legacy ground']);
    await migrate(db, { migrationsFolder: 'drizzle' });

    process.env.DATABASE_URL = testUrl;
    process.env.JWT_SECRET = randomBytes(48).toString('base64url');
    app = await NestFactory.create(AppModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;
    const fixture = drizzle(client, { schema: tables });
    await fixture.insert(tables.leagues).values({ id: league, ownerId: userId, name: 'Local cricket', slug: league });
    await fixture.insert(tables.tournaments).values([
      { id: tournament, leagueId: league, name: 'First edition', season: '2026' },
      { id: otherTournament, leagueId: league, name: 'Second edition', season: '2027' },
    ]);
    await fixture.insert(tables.tournamentTeams).values([
      { tournamentId: tournament, teamId: teamA }, { tournamentId: tournament, teamId: teamB },
      { tournamentId: otherTournament, teamId: teamA }, { tournamentId: otherTournament, teamId: teamB },
    ]);
    await fixture.insert(tables.tournamentPlayers).values([
      { id: rosterA, tournamentId: tournament, playerId: playerA, teamId: teamA, role: 'BAT', price: '9.50' },
      { id: rosterB, tournamentId: tournament, playerId: playerB, teamId: teamB, role: 'BWL', price: '8.50' },
      { id: otherRoster, tournamentId: otherTournament, playerId: playerA, teamId: teamA, role: 'BAT', price: '7.50' },
    ]);
    await fixture.insert(tables.tournamentRounds).values([
      { id: round1, tournamentId: tournament, number: 1, name: 'Round 1', deadline: new Date('2030-01-01T00:00:00Z') },
      { id: round2, tournamentId: tournament, number: 2, name: 'Round 2', deadline: new Date('2030-01-02T00:00:00Z') },
      { id: otherRound, tournamentId: otherTournament, number: 1, name: 'Round 1', deadline: new Date('2031-01-01T00:00:00Z') },
    ]);
    await fixture.insert(tables.matches).values({ id: match, tournamentId: tournament, roundId: round1, matchNumber: 1, team1_id: teamA, team2_id: teamB, venue: 'Local ground', date: new Date('2030-01-01T10:00:00Z') });
    await fixture.insert(tables.matchPlayers).values([
      { matchId: match, tournamentId: tournament, tournamentPlayerId: rosterA },
      { matchId: match, tournamentId: tournament, tournamentPlayerId: rosterB },
    ]);
    await fixture.insert(tables.statDefinitions).values({ id: metric, sport: 'cricket', key: `runs_${metric}`, name: 'Runs' });
    await fixture.insert(tables.matchStatRevisions).values({ id: revision, matchId: match, tournamentId: tournament, revision: 1, status: 'published', submittedBy: userId, publishedAt: new Date() });
    await fixture.insert(tables.playerMatchStats).values({ revisionId: revision, matchId: match, tournamentId: tournament, tournamentPlayerId: rosterA, statDefinitionId: metric, value: '50' });
    await fixture.insert(tables.cricketInnings).values({ revisionId: revision, matchId: match, tournamentId: tournament, number: 1, battingTeamId: teamA, bowlingTeamId: teamB, runs: 150, wickets: 5, legalBalls: 120, extras: 10 });
    await fixture.insert(tables.matchResults).values({ revisionId: revision, matchId: match, tournamentId: tournament, outcome: 'team_win', winnerTeamId: teamA });
    await fixture.insert(tables.fantasyRuleSets).values({ id: rules, tournamentId: tournament, name: 'Test policy', version: 1, squadSize: 2, startingSize: 2, budget: '100', maxPerTeam: 2, transferLimit: 3, captainMultiplier: '2', roleLimits: {} });
    await fixture.insert(tables.fantasyScoringRules).values({ ruleSetId: rules, statDefinitionId: metric, pointsPerUnit: '1' });
    await fixture.insert(tables.fantasyLeagues).values({ id: fantasy, tournamentId: tournament, ruleSetId: rules, ownerId: userId, name: 'Friends' });
    await fixture.insert(tables.fantasyEntries).values({ id: entry, fantasyLeagueId: fantasy, tournamentId: tournament, userId, name: 'My squad' });
    await fixture.insert(tables.fantasySquads).values([
      { id: squad, entryId: entry, fantasyLeagueId: fantasy, tournamentId: tournament, roundId: round1, status: 'locked', lockedAt: new Date() },
      { id: laterSquad, entryId: entry, fantasyLeagueId: fantasy, tournamentId: tournament, roundId: round2 },
    ]);
    await fixture.insert(tables.fantasySquadPicks).values({ squadId: squad, tournamentId: tournament, tournamentPlayerId: rosterA, slot: 1, purchasePrice: '9.50', isStarting: true, isCaptain: true });
    await fixture.insert(tables.scoringRuns).values({ id: run, fantasyLeagueId: fantasy, tournamentId: tournament, matchId: match, roundId: round1, revisionId: revision, ruleSetId: rules, engineVersion: 'schema-fixture', isCurrent: true, status: 'completed', completedAt: new Date() });
  }, 90000);

  beforeEach(async () => { await client.query('SAVEPOINT test_case'); });
  afterEach(async () => { await client.query('ROLLBACK TO SAVEPOINT test_case'); });
  afterAll(async () => {
    try {
      if (transactionStarted) await client.query('ROLLBACK');
      client?.release();
      await app?.close();
      if (pool) {
        await pool.query('delete from matches where id = $1', [legacyMatch]);
        await pool.query('delete from players where id = any($1::uuid[])', [[playerA, playerB]]);
        await pool.query('delete from teams where id = any($1::uuid[])', [[teamA, teamB]]);
        await pool.query('delete from users where id = $1', [userId]);
      }
    } finally {
      await pool?.end();
      if (originalSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = originalSecret;
      if (originalUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalUrl;
      if (tempMigrations) rmSync(tempMigrations, { recursive: true, force: true });
    }
  }, 30000);

  async function rejectsSql(code: string, query: string, values: unknown[]) {
    try { await client.query(query, values); }
    catch (error) { expect((error as { code: string }).code).toBe(code); return; }
    throw new Error(`Expected PostgreSQL ${code}`);
  }

  it('upgrades existing rows and serves real PostgreSQL through Nest', async () => {
    const health = await fetch(`${origin}/health/database`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok', database: 'connected' });
    const players = await fetch(`${origin}/api/players`);
    expect(players.status).toBe(200);
    expect((await players.json() as { data: { id: string }[] }).data.some((p) => p.id === playerA)).toBe(true);
    const response = await fetch(`${origin}/api/matches`);
    expect(response.status).toBe(200);
    expect((await response.json() as { data: { id: string }[] }).data.some((m) => m.id === legacyMatch)).toBe(true);
  }, 30000);

  it('enforces case-insensitive identity uniqueness in PostgreSQL', async () => {
    await rejectsSql('23505', 'insert into users (username,email,password_hash) select upper(username),$2,$3 from users where id=$1', [userId, `${id()}@example.invalid`, 'test-only']);
  });

  it('authenticates with PostgreSQL, rotates refresh tokens atomically and revokes sessions', async () => {
    const username = `auth_${id().replaceAll('-', '').slice(0, 20)}`;
    const email = `${username}@example.invalid`;
    const password = 'Only-for-integration-123';
    let createdUser: string | undefined;
    type Credentials = { user: { id: string; role: string }; accessToken: string; refreshToken: string };
    const post = (route: string, body: unknown) => fetch(`${origin}/api/auth/${route}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const me = (token: string) => fetch(`${origin}/api/auth/me`, { headers: { authorization: `Bearer ${token}` } });
    try {
      const registration = await post('register', { username, email: email.toUpperCase(), password });
      expect(registration.status).toBe(201);
      const signup = await registration.json() as Credentials;
      createdUser = signup.user.id;
      expect(signup.user.role).toBe('user');
      const stored = await pool.query('select password_hash from users where id=$1', [createdUser]);
      expect(stored.rows[0].password_hash.startsWith('$argon2id$')).toBe(true);
      expect(await Bun.password.verify(password, stored.rows[0].password_hash)).toBe(true);
      expect((await me(signup.accessToken)).status).toBe(200);
      const duplicate = await post('register', { username: `${username}_2`, email, password });
      expect(duplicate.status).toBe(409);
      expect((await post('login', { email, password: 'Incorrect-password-123' })).status).toBe(401);
      const login = await post('login', { email, password });
      expect(login.status).toBe(200);
      const credentials = await login.json() as Credentials;
      const storedSession = await pool.query('select refresh_token_hash from auth_sessions where id=$1', [credentials.refreshToken.slice(0, 36)]);
      expect(storedSession.rows[0].refresh_token_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(storedSession.rows[0].refresh_token_hash).not.toBe(credentials.refreshToken);
      const responses = await Promise.all([
        post('refresh', { refreshToken: credentials.refreshToken }),
        post('refresh', { refreshToken: credentials.refreshToken }),
      ]);
      expect(responses.map((r) => r.status).sort()).toEqual([200, 401]);
      const next = await responses.find((r) => r.status === 200)!.json() as Credentials;
      expect((await me(next.accessToken)).status).toBe(200);
      expect((await post('refresh', { refreshToken: credentials.refreshToken })).status).toBe(401);
      expect((await post('logout', { refreshToken: next.refreshToken })).status).toBe(204);
      expect((await me(next.accessToken)).status).toBe(401);
      expect((await me(credentials.accessToken)).status).toBe(401);
      expect((await post('refresh', { refreshToken: next.refreshToken })).status).toBe(401);
      // Logout is scoped to one session; another device's login remains valid.
      expect((await me(signup.accessToken)).status).toBe(200);
      await pool.query("update auth_sessions set created_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1", [signup.refreshToken.slice(0, 36)]);
      expect((await me(signup.accessToken)).status).toBe(401);
      expect((await post('refresh', { refreshToken: signup.refreshToken })).status).toBe(401);
    } finally {
      if (createdUser) await pool.query('delete from users where id=$1', [createdUser]);
    }
  }, 30000);

  it('runs the league/tournament checkpoint with real ownership and staff permissions', async () => {
    const adminId = id(), scorerId = id(), outsiderId = id();
    const staffNames = [adminId, scorerId, outsiderId].map((value) => `staff_${value.replaceAll('-', '').slice(0, 20)}`);
    const leagueIds: string[] = [];
    const sessionIds: string[] = [];
    const jwt = new JwtService();
    const tokens = new Map<string, string>();
    const call = (actor: string | undefined, method: string, path: string, body?: unknown) => fetch(`${origin}/api/leagues${path}`, {
      method, headers: { ...(actor ? { authorization: `Bearer ${tokens.get(actor)}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    try {
      for (const [index, account] of [adminId, scorerId, outsiderId].entries()) {
        await pool.query('insert into users (id,username,email,password_hash,role) values ($1,$2,$3,$4,$5)', [account, staffNames[index], `${account}@example.invalid`, 'test-only', account === outsiderId ? 'admin' : 'user']);
      }
      for (const account of [userId, adminId, scorerId, outsiderId]) {
        const session = id(); sessionIds.push(session);
        await pool.query("insert into auth_sessions (id,user_id,refresh_token_hash,expires_at) values ($1,$2,$3,now()+interval '1 day')", [session, account, randomBytes(32).toString('hex')]);
        tokens.set(account, await jwt.signAsync({ sub: account, sid: session, tokenUse: 'access' }, { secret: process.env.JWT_SECRET!, issuer: 'local-fantasy-api', audience: 'local-fantasy-clients', algorithm: 'HS256', expiresIn: 900 }));
      }
      expect((await call(undefined, 'GET', '')).status).toBe(401);
      expect((await call(userId, 'POST', '', { name: 'Injected', ownerId: outsiderId })).status).toBe(400);
      expect((await call(userId, 'POST', '', { name: 'Injected', sport: 'football' })).status).toBe(400);
      expect((await call(userId, 'POST', '', { name: ' ' })).status).toBe(400);
      const created = await call(userId, 'POST', '', { name: ' Local cricket ', location: 'Kathmandu' });
      expect(created.status).toBe(201);
      const local = await created.json() as { id: string; ownerId: string; slug: string; sport: string; name: string };
      leagueIds.push(local.id);
      expect(local).toMatchObject({ ownerId: userId, name: 'Local cricket', sport: 'cricket' });
      expect(local.slug).toMatch(/^local-cricket-/);
      const other = await call(outsiderId, 'POST', '', { name: 'Other league' });
      const otherLeague = await other.json() as { id: string }; leagueIds.push(otherLeague.id);
      expect((await call(outsiderId, 'GET', `/${local.id}`)).status).toBe(404);
      const mine = await (await call(outsiderId, 'GET', '')).json() as { data: { id: string }[]; pageSize: number };
      expect(mine.data.map((row) => row.id)).toContain(otherLeague.id);
      expect(mine.data.map((row) => row.id)).not.toContain(local.id);
      expect(mine.pageSize).toBe(20);
      expect((await call(userId, 'GET', '?page=0')).status).toBe(400);
      expect((await call(userId, 'GET', '?limit=1000')).status).toBe(400);
      expect((await call(userId, 'GET', '/not-a-uuid')).status).toBe(400);
      expect((await call(userId, 'PATCH', `/${local.id}`, {})).status).toBe(400);
      const renamed = await call(userId, 'PATCH', `/${local.id}`, { name: 'Renamed league' });
      expect(renamed.status).toBe(200);
      expect((await renamed.json() as { slug: string }).slug).toBe(local.slug);
      expect((await call(userId, 'PUT', `/${local.id}/staff`, { username: 'no_such_registered_user', role: 'admin' })).status).toBe(404);
      for (const [username, role] of [[staffNames[0], 'admin'], [staffNames[1], 'scorer']]) {
        expect((await call(userId, 'PUT', `/${local.id}/staff`, { username, role })).status).toBe(200);
      }
      expect((await call(adminId, 'PATCH', `/${local.id}`, { name: 'Takeover' })).status).toBe(403);
      expect((await call(adminId, 'PUT', `/${local.id}/staff`, { username: staffNames[2], role: 'admin' })).status).toBe(403);
      expect((await call(scorerId, 'GET', `/${local.id}`)).status).toBe(200);
      expect((await call(scorerId, 'GET', `/${local.id}/staff`)).status).toBe(403);
      const staff = await (await call(userId, 'GET', `/${local.id}/staff`)).json() as { data: Record<string, unknown>[] };
      expect(staff.data.length).toBe(2);
      expect(Object.keys(staff.data[0]!).sort()).toEqual(['role', 'userId', 'username']);
      const adminLeagues = await (await call(adminId, 'GET', '')).json() as { data: { id: string }[] };
      expect(adminLeagues.data.some((row) => row.id === local.id)).toBe(true);
      expect((await call(scorerId, 'POST', `/${local.id}/tournaments`, { name: 'Blocked', season: '2026' })).status).toBe(403);
      expect((await call(adminId, 'POST', `/${local.id}/tournaments`, { name: 'Bad timezone', season: '2026', timezone: 'not/a/timezone' })).status).toBe(400);
      expect((await call(adminId, 'POST', `/${local.id}/tournaments`, { name: 'Bad dates', season: '2026', startsAt: '2030-02-01T00:00:00Z', endsAt: '2030-01-01T00:00:00Z' })).status).toBe(400);
      expect((await call(adminId, 'POST', `/${local.id}/tournaments`, { name: 'Injected', season: '2026', status: 'live' })).status).toBe(400);
      const editionResponse = await call(adminId, 'POST', `/${local.id}/tournaments`, { name: 'First edition', season: '2026', startsAt: '2030-01-01T00:00:00Z', endsAt: '2030-02-01T00:00:00Z' });
      expect(editionResponse.status).toBe(201);
      const edition = await editionResponse.json() as { id: string; status: string; timezone: string };
      expect(edition).toMatchObject({ status: 'draft', timezone: 'Asia/Kathmandu' });
      expect((await call(userId, 'POST', `/${local.id}/tournaments`, { name: 'Duplicate', season: '2026' })).status).toBe(409);
      expect((await call(outsiderId, 'POST', `/${otherLeague.id}/tournaments`, { name: 'Same season elsewhere', season: '2026' })).status).toBe(201);
      expect((await call(scorerId, 'GET', `/${local.id}/tournaments/${edition.id}`)).status).toBe(200);
      expect((await call(scorerId, 'GET', `/${local.id}/tournaments`)).status).toBe(200);
      expect((await call(outsiderId, 'GET', `/${otherLeague.id}/tournaments/${edition.id}`)).status).toBe(404);
      expect((await call(scorerId, 'PATCH', `/${local.id}/tournaments/${edition.id}`, { name: 'Blocked' })).status).toBe(403);
      expect((await call(adminId, 'PATCH', `/${local.id}/tournaments/${edition.id}`, { startsAt: '2030-03-01T00:00:00Z' })).status).toBe(400);
      expect((await call(adminId, 'PATCH', `/${local.id}/tournaments/${edition.id}`, { name: 'Updated edition' })).status).toBe(200);
      await pool.query("update tournaments set status='live' where id=$1", [edition.id]);
      expect((await call(adminId, 'PATCH', `/${local.id}/tournaments/${edition.id}`, { name: 'Locked' })).status).toBe(409);
      expect((await call(userId, 'DELETE', `/${local.id}/staff/${userId}`)).status).toBe(400);
      expect((await call(userId, 'DELETE', `/${local.id}/staff/${adminId}`)).status).toBe(204);
      expect((await call(adminId, 'GET', `/${local.id}`)).status).toBe(404);
      expect((await call(adminId, 'POST', `/${local.id}/tournaments`, { name: 'Removed staff', season: '2028' })).status).toBe(404);
      const removedList = await (await call(adminId, 'GET', '')).json() as { data: { id: string }[] };
      expect(removedList.data.some((row) => row.id === local.id)).toBe(false);
      expect((await call(userId, 'PUT', `/${local.id}/staff`, { username: staffNames[0], role: 'scorer' })).status).toBe(200);
      expect((await call(adminId, 'GET', `/${local.id}`)).status).toBe(200);
      expect((await call(adminId, 'POST', `/${local.id}/tournaments`, { name: 'Now scorer', season: '2028' })).status).toBe(403);
    } finally {
      await pool.query('delete from tournaments where league_id=any($1::uuid[])', [leagueIds]);
      await pool.query('delete from league_members where league_id=any($1::uuid[])', [leagueIds]);
      await pool.query('delete from leagues where id=any($1::uuid[])', [leagueIds]);
      await pool.query('delete from auth_sessions where id=any($1::uuid[])', [sessionIds]);
      await pool.query('delete from users where id=any($1::uuid[])', [[adminId, scorerId, outsiderId]]);
    }
  }, 60000);

  it('manages season rosters and publishes fixtures without exposing draft schedules', async () => {
    const sessionId = id(), scorerId = id(), scorerSessionId = id();
    const leagueIds: string[] = [];
    const ownerToken = await new JwtService().signAsync(
      { sub: userId, sid: sessionId, tokenUse: 'access' },
      { secret: process.env.JWT_SECRET!, issuer: 'local-fantasy-api', audience: 'local-fantasy-clients', algorithm: 'HS256', expiresIn: 900 },
    );
    const scorerToken = await new JwtService().signAsync(
      { sub: scorerId, sid: scorerSessionId, tokenUse: 'access' },
      { secret: process.env.JWT_SECRET!, issuer: 'local-fantasy-api', audience: 'local-fantasy-clients', algorithm: 'HS256', expiresIn: 900 },
    );
    const call = (method: string, path: string, body?: object, token = ownerToken) => fetch(`${origin}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body && JSON.stringify(body),
    });
    const create = async (path: string, body: object) => {
      const response = await call('POST', path, body);
      if (response.status !== 201) throw new Error(`Create ${path} returned ${response.status}: ${await response.text()}`);
      return await response.json() as { id: string };
    };

    try {
      await pool.query("insert into auth_sessions (id,user_id,refresh_token_hash,expires_at) values ($1,$2,$3,now()+interval '1 day')", [sessionId, userId, randomBytes(32).toString('hex')]);
      const local = await create('/api/leagues', { name: 'Roster trial' });
      leagueIds.push(local.id);
      await pool.query('insert into users (id,username,email,password_hash) values ($1,$2,$3,$4)', [scorerId, `scorer-${scorerId}`, `${scorerId}@example.invalid`, 'test-only']);
      await pool.query("insert into auth_sessions (id,user_id,refresh_token_hash,expires_at) values ($1,$2,$3,now()+interval '1 day')", [scorerSessionId, scorerId, randomBytes(32).toString('hex')]);
      await pool.query("insert into league_members (league_id,user_id,role) values ($1,$2,'scorer')", [local.id, scorerId]);
      const independent = await create('/api/leagues', { name: 'Independent league' });
      leagueIds.push(independent.id);
      const base = `/api/leagues/${local.id}`;
      const first = await create(`${base}/tournaments`, { name: 'First', season: '2026' });
      const next = await create(`${base}/tournaments`, { name: 'Next', season: '2027' });
      const a = await create(`${base}/teams`, { name: 'Home XI', code: 'HOME' });
      const b = await create(`${base}/teams`, { name: 'Away XI', code: 'AWAY' });
      const foreignTeam = await create(`/api/leagues/${independent.id}/teams`, { name: 'Home XI', code: 'HOME' });
      expect((await call('POST', `${base}/teams`, { name: 'home xi', code: 'HX' })).status).toBe(409);
      const player = await create(`${base}/players`, { name: 'Roster-only Ram', role: 'BAT' });
      expect((await call('PATCH', `${base}/players/${player.id}`, { name: null })).status).toBe(400);
      const year1 = `${base}/tournaments/${first.id}`;
      const year2 = `${base}/tournaments/${next.id}`;
      expect((await call('PUT', `${year1}/teams/${foreignTeam.id}`)).status).toBe(404);
      expect((await call('PUT', `${year1}/players/${player.id}`, { teamId: a.id })).status).toBe(404);
      for (const [path, team] of [[year1, a], [year1, b], [year2, b]] as const) {
        expect((await call('PUT', `${path}/teams/${team.id}`)).status).toBe(204);
      }
      expect((await call('PUT', `${year1}/players/${player.id}`, { teamId: a.id, price: 12 })).status).toBe(400);
      expect((await call('PUT', `${year1}/players/${player.id}`, { teamId: a.id })).status).toBe(204);
      expect((await call('PUT', `${year2}/players/${player.id}`, { teamId: b.id, role: 'AR' })).status).toBe(204);
      const oldRoster = await (await call('GET', `${year1}/players`)).json() as { data: { id: string }[] };
      const newRoster = await (await call('GET', `${year2}/players`)).json();
      expect(oldRoster.data).toMatchObject([{ playerId: player.id, teamId: a.id, role: 'BAT' }]);
      expect(newRoster).toMatchObject({ data: [{ playerId: player.id, teamId: b.id, role: 'AR' }] });
      expect((await call('DELETE', `${year1}/teams/${a.id}`)).status).toBe(409);
      const staffSchedule = `${year1}/schedule`;
      const publicSchedule = `${origin}/api/tournaments/${first.id}/schedule`;
      const reportBase = `${origin}/api/tournaments/${first.id}/reports`;
      const report = async (path: string) => {
        const response = await fetch(`${reportBase}/${path}`);
        if (response.status !== 200) throw new Error(`Report ${path} returned ${response.status}: ${await response.text()}`);
        return await response.json();
      };
      for (const path of ['results', 'standings', 'players']) {
        expect((await fetch(`${reportBase}/${path}`)).status).toBe(404);
      }
      const details = { matchNumber: 1, team1Id: a.id, team2Id: b.id, date: '2030-02-01T10:00:00+05:45', venue: 'Ground' };
      expect((await fetch(publicSchedule)).status).toBe(404);
      expect((await fetch(`${origin}${staffSchedule}`)).status).toBe(401);
      expect((await call('PUT', `${staffSchedule}/publish`)).status).toBe(409);
      expect((await call('POST', `${staffSchedule}/fixtures`, { ...details, team2Id: a.id })).status).toBe(400);
      expect((await call('POST', `${staffSchedule}/fixtures`, { ...details, team2Id: foreignTeam.id })).status).toBe(400);
      const temporary = await create(`${staffSchedule}/fixtures`, { ...details, matchNumber: 2 });
      expect((await call('DELETE', `${staffSchedule}/fixtures/${temporary.id}`)).status).toBe(204);
      const { id: fixture } = await create(`${staffSchedule}/fixtures`, details);
      expect((await call('POST', `${staffSchedule}/fixtures`, details)).status).toBe(409);
      expect((await call('PATCH', `${year2}/schedule/fixtures/${fixture}`, { venue: 'Wrong tournament' })).status).toBe(404);
      expect((await call('PATCH', `${staffSchedule}/fixtures/${fixture}`, { venue: 'New Ground' })).status).toBe(204);
      expect((await call('PATCH', `${staffSchedule}/fixtures/${fixture}/status`, { status: 'live' })).status).toBe(409);
      const draftSchedule = await call('GET', staffSchedule);
      expect(await draftSchedule.json()).toMatchObject({ publishedAt: null, data: [{ id: fixture, venue: 'New Ground' }] });
      expect((await fetch(publicSchedule)).status).toBe(404);

      const published = await call('PUT', `${staffSchedule}/publish`);
      expect(published.status).toBe(200);
      expect(await report('results')).toMatchObject({ data: [] });
      expect(await report('standings')).toMatchObject({ data: [
        { rank: 1, team: { id: b.id }, played: 0, points: 0, netRunRate: null },
        { rank: 1, team: { id: a.id }, played: 0, points: 0, netRunRate: null },
      ] });
      expect((await fetch(`${reportBase}/players?category=invalid`)).status).toBe(400);
      const publishedBody = await published.json();
      const repeated = await call('PUT', `${staffSchedule}/publish`);
      expect(await repeated.json()).toEqual(publishedBody);
      const visible = await fetch(publicSchedule);
      expect(visible.status).toBe(200);
      expect(await visible.json()).toMatchObject({
        timezone: 'Asia/Kathmandu',
        data: [{ id: fixture, venue: 'New Ground', date: '2030-02-01T04:15:00.000Z', team1: { id: a.id }, team2: { id: b.id }, status: 'upcoming' }],
      });
      expect((await call('DELETE', `${staffSchedule}/fixtures/${fixture}`)).status).toBe(409);
      expect((await call('PATCH', `${staffSchedule}/fixtures/${fixture}/status`, { status: 'live' })).status).toBe(204);
      expect((await call('PATCH', `${staffSchedule}/fixtures/${fixture}`, { venue: 'Late change' })).status).toBe(409);
      expect((await call('PATCH', `${staffSchedule}/fixtures/${fixture}/status`, { status: 'cancelled' })).status).toBe(204);
      expect((await call('PATCH', `${staffSchedule}/fixtures/${fixture}/status`, { status: 'live' })).status).toBe(409);
      expect(await (await fetch(publicSchedule)).json()).toMatchObject({ data: [{ id: fixture, status: 'cancelled' }] });
      const homePartner = await create(`${base}/players`, { name: 'Home partner', role: 'AR' });
      const awayBowler = await create(`${base}/players`, { name: 'Away bowler', role: 'BWL' });
      const awayKeeper = await create(`${base}/players`, { name: 'Away keeper', role: 'WK' });
      for (const [profile, teamId] of [[homePartner, a.id], [awayBowler, b.id], [awayKeeper, b.id]] as const) {
        expect((await call('PUT', `${year1}/players/${profile.id}`, { teamId })).status).toBe(204);
      }
      const roster = await (await call('GET', `${year1}/players`)).json() as { data: { id: string; playerId: string }[] };
      const registration = (profile: { id: string }) => roster.data.find((row) => row.playerId === profile.id)!.id;
      const ram = registration(player), partner = registration(homePartner);
      const bowler = registration(awayBowler), keeper = registration(awayKeeper);
      const scoredFixture = await create(`${staffSchedule}/fixtures`, { ...details, matchNumber: 3 });
      const staffCard = `${staffSchedule}/fixtures/${scoredFixture.id}/scorecard`;
      const publicCard = `${origin}/api/tournaments/${first.id}/fixtures/${scoredFixture.id}/scorecard`;
      expect((await fetch(publicCard)).status).toBe(404);
      expect((await call('PATCH', `${staffSchedule}/fixtures/${scoredFixture.id}/status`, { status: 'live' })).status).toBe(204);
      const setup = await call('PUT', `${staffCard}/lineups`, { overs: 1, team1: [ram, partner], team2: [bowler, keeper] }, scorerToken);
      expect(setup.status).toBe(200);
      let version = 0;
      const play = async (path: string, data: object, method = 'POST') => {
        const token = path === 'publish' || path === 'correction' ? ownerToken : scorerToken;
        const response = await call(method, `${staffCard}/${path}`, { ...data, version }, token);
        if (response.status !== 200) throw new Error(`${path} failed with ${response.status}: ${await response.text()}`);
        const result = await response.json() as { version: number; revision?: number; winnerTeamId?: string };
        version = result.version;
        return result;
      };
      await play('innings', { teamId: a.id, strikerId: ram, nonStrikerId: partner });
      await play('bowler', { playerId: bowler }, 'PUT');
      const competing = await Promise.all([
        call('POST', `${staffCard}/deliveries`, { version, batRuns: 1 }),
        call('POST', `${staffCard}/deliveries`, { version, batRuns: 1 }),
      ]);
      expect(competing.map((response) => response.status).sort()).toEqual([200, 409]);
      version++;
      await play('deliveries', { batRuns: 0, extra: 'wide' });
      await play('deliveries', { batRuns: 0, extra: 'no_ball' });
      const invalidWicket = await call('POST', `${staffCard}/deliveries`, { version, batRuns: 0, dismissal: 'bowled', dismissedPlayerId: partner });
      expect(invalidWicket.status).toBe(400);
      expect(await (await fetch(publicCard)).json()).toMatchObject({
        official: null, innings: [{ runs: 3, extras: 2, legalBalls: 1, strikerId: partner, bowlerId: bowler, freeHit: true }],
      });
      await play('deliveries', { batRuns: 0 });
      await play('deliveries', { batRuns: 0, dismissal: 'caught', dismissedPlayerId: partner, fielderIds: [keeper] });
      await play('innings', { teamId: b.id, strikerId: keeper, nonStrikerId: bowler });
      await play('bowler', { playerId: ram }, 'PUT');
      await play('deliveries', { batRuns: 4, boundary: 4 });
      expect((await call('POST', `${staffCard}/publish`, { version }, scorerToken)).status).toBe(403);
      const result = await play('publish', {});
      expect(result).toMatchObject({ revision: 1, winnerTeamId: b.id });
      expect(await (await fetch(publicCard)).json()).toMatchObject({ status: 'completed', official: { revision: 1 }, innings: [{ runs: 3 }, { runs: 4, closed: true }] });
      expect(await report('standings')).toMatchObject({ data: [
        { rank: 1, team: { id: b.id }, points: 2, netRunRate: 21, netRunRateMatches: 1 },
        { rank: 2, team: { id: a.id }, points: 0, netRunRate: -21, netRunRateMatches: 1 },
      ] });
      await play('correction', {});
      await play('undo', {});
      expect(await (await fetch(publicCard)).json()).toMatchObject({ official: { revision: 1 }, innings: [{ runs: 3 }, { runs: 4 }] });
      expect(await (await call('GET', staffCard)).json()).toMatchObject({ correcting: true, innings: [{ runs: 3 }, { runs: 0 }] });
      expect(await report('results')).toMatchObject({ data: [{ fixtureId: scoredFixture.id, revision: 1, innings: [{ runs: 3 }, { runs: 4 }] }] });
      await play('deliveries', { batRuns: 6, boundary: 6 });
      expect(await play('publish', {})).toMatchObject({ revision: 2, winnerTeamId: b.id });
      const revisions = await pool.query('select revision, status, cricket_card from match_stat_revisions where match_id=$1 order by revision', [scoredFixture.id]);
      expect(revisions.rows.map((row) => [row.revision, row.status, row.cricket_card.innings[1].runs])).toEqual([
        [1, 'superseded', 4], [2, 'published', 6],
      ]);
      const stats = await pool.query(`
        select s.value::int as value from player_match_stats s
        join match_stat_revisions r on r.id=s.revision_id
        join stat_definitions d on d.id=s.stat_definition_id
        where r.match_id=$1 and r.status='published' and s.tournament_player_id=$2 and d.key='sixes'
      `, [scoredFixture.id, keeper]);
      expect(stats.rows).toEqual([{ value: 1 }]);

      const returnFixture = await create(`${staffSchedule}/fixtures`, { ...details, matchNumber: 4 });
      const abandonedFixture = await create(`${staffSchedule}/fixtures`, { ...details, matchNumber: 5 });
      const returnRevision = id(), abandonedRevision = id();
      await pool.query('insert into cricket_scoring (match_id,overs) values ($1,1),($2,1)', [returnFixture.id, abandonedFixture.id]);
      await pool.query(
        "insert into match_stat_revisions (id,match_id,tournament_id,revision,status,submitted_by,published_at) values ($1,$2,$3,1,'published',$4,now()),($5,$6,$3,1,'published',$4,now())",
        [returnRevision, returnFixture.id, first.id, userId, abandonedRevision, abandonedFixture.id],
      );
      await pool.query(
        "insert into match_results (revision_id,match_id,tournament_id,outcome,winner_team_id) values ($1,$2,$3,'team_win',$4),($5,$6,$3,'no_result',null)",
        [returnRevision, returnFixture.id, first.id, a.id, abandonedRevision, abandonedFixture.id],
      );
      await pool.query(
        'insert into cricket_innings (revision_id,match_id,tournament_id,number,batting_team_id,bowling_team_id,runs,wickets,legal_balls,extras) values ($1,$2,$3,1,$4,$5,10,0,6,0),($1,$2,$3,2,$5,$4,9,0,6,0),($6,$7,$3,1,$4,$5,100,0,6,0),($6,$7,$3,2,$5,$4,50,0,6,0)',
        [returnRevision, returnFixture.id, first.id, a.id, b.id, abandonedRevision, abandonedFixture.id],
      );
      expect(await report('standings')).toMatchObject({ data: [
        { rank: 1, team: { id: b.id }, played: 3, won: 1, lost: 1, noResult: 1, points: 3, netRunRate: 6.357, netRunRateMatches: 2 },
        { rank: 2, team: { id: a.id }, played: 3, won: 1, lost: 1, noResult: 1, points: 3, netRunRate: -6.357, netRunRateMatches: 2 },
      ] });
      expect(await report('results')).toMatchObject({ data: [
        { fixtureId: abandonedFixture.id, outcome: 'no_result' },
        { fixtureId: returnFixture.id, winnerTeamId: a.id },
        { fixtureId: scoredFixture.id, revision: 2, innings: [{ runs: 3 }, { runs: 6 }] },
      ] });
      expect(await report('players')).toMatchObject({ category: 'batting', data: [
        { registrationId: keeper, matches: 1, rank: 1, metrics: { runs: 6, sixes: 1, fours: 0 }, strikeRate: 600 },
        { registrationId: ram, rank: 2, metrics: { runs: 1 } },
        { registrationId: partner, rank: 3, metrics: { runs: 0, balls_faced: 3 } },
      ] });
      expect(await report('players?category=bowling')).toMatchObject({ data: [
        { registrationId: bowler, rank: 1, metrics: { wickets: 1, balls_bowled: 3 }, economy: 6 },
        { registrationId: ram, rank: 2, metrics: { wickets: 0 }, economy: 36 },
      ] });
      expect(await report('players?category=fielding')).toMatchObject({ data: [
        { registrationId: keeper, rank: 1, metrics: { catches: 1 }, dismissalsInvolved: 1 },
      ] });
      expect(await report('standings?page=2')).toMatchObject({ page: 2, pageSize: 20, data: [] });

      await pool.query('insert into match_players (match_id,tournament_id,tournament_player_id) values ($1,$2,$3)', [fixture, first.id, oldRoster.data[0]!.id]);
      expect((await call('PUT', `${year1}/players/${player.id}`, { teamId: b.id })).status).toBe(409);
      expect((await call('DELETE', `${year1}/players/${player.id}`)).status).toBe(409);
      expect((await call('DELETE', `${year2}/players/${player.id}`)).status).toBe(204);
      expect((await call('DELETE', `${year2}/teams/${b.id}`)).status).toBe(204);
      const legacy = await (await fetch(`${origin}/api/players`)).json() as { data: { id: string }[] };
      expect(legacy.data.some((row) => row.id === player.id)).toBe(false);
      expect(legacy.data.some((row) => row.id === playerA)).toBe(true);
      const publicMatches = await (await fetch(`${origin}/api/matches`)).json() as { data: { id: string }[] };
      expect(publicMatches.data.some((row) => row.id === fixture)).toBe(false);
      expect(publicMatches.data.some((row) => row.id === legacyMatch)).toBe(true);
    } finally {
      for (const table of ['player_match_stats', 'cricket_innings', 'match_results', 'match_stat_revisions']) {
        await pool.query(`delete from ${table} where tournament_id in (select id from tournaments where league_id=any($1::uuid[]))`, [leagueIds]);
      }
      for (const table of ['cricket_plays', 'cricket_scoring']) {
        await pool.query(`delete from ${table} where match_id in (select m.id from matches m join tournaments t on t.id=m.tournament_id where t.league_id=any($1::uuid[]))`, [leagueIds]);
      }
      for (const table of ['match_players', 'matches', 'tournament_rounds', 'tournament_players', 'tournament_teams']) {
        await pool.query(`delete from ${table} where tournament_id in (select id from tournaments where league_id=any($1::uuid[]))`, [leagueIds]);
      }
      await pool.query('delete from tournaments where league_id=any($1::uuid[])', [leagueIds]);
      await pool.query('delete from players where league_id=any($1::uuid[])', [leagueIds]);
      await pool.query('delete from teams where league_id=any($1::uuid[])', [leagueIds]);
      await pool.query('delete from league_members where user_id=$1', [scorerId]);
      await pool.query('delete from leagues where id=any($1::uuid[])', [leagueIds]);
      await pool.query('delete from auth_sessions where id=any($1::uuid[])', [[sessionId, scorerSessionId]]);
      await pool.query('delete from users where id=$1', [scorerId]);
    }
  }, 30000);

  it('keeps legacy fixtures unassigned after migration', async () => {
    const { rows } = await client.query('select tournament_id, round_id from matches where id = $1', [legacyMatch]);
    expect(rows[0]).toEqual({ tournament_id: null, round_id: null });
  });

  it('preserves fractional tournament prices', async () => {
    const { rows } = await client.query('select price from tournament_players where id = $1', [rosterA]);
    expect(rows[0].price).toBe('9.50');
  });

  it('rejects a player from a different tournament in a squad', async () => {
    await rejectsSql('23503', 'insert into fantasy_squad_picks (squad_id,tournament_id,tournament_player_id,slot,purchase_price,is_starting) values ($1,$2,$3,2,10,true)', [squad, tournament, otherRoster]);
  });

  it('rejects a fixture using a round from another tournament', async () => {
    await rejectsSql('23503', 'insert into matches (tournament_id,round_id,match_number,team1_id,team2_id,venue,date) values ($1,$2,2,$3,$4,$5,now())', [tournament, otherRound, teamA, teamB, 'Ground']);
  });

  it('rejects two captains in a squad', async () => {
    await rejectsSql('23505', 'insert into fantasy_squad_picks (squad_id,tournament_id,tournament_player_id,slot,purchase_price,is_starting,is_captain) values ($1,$2,$3,2,10,true,true)', [squad, tournament, rosterB]);
  });

  it('rejects a second published stats revision for the same match', async () => {
    await rejectsSql('23505', 'insert into match_stat_revisions (match_id,tournament_id,revision,status,submitted_by,published_at) values ($1,$2,2,$3,$4,now())', [match, tournament, 'published', userId]);
  });

  it('rejects impossible cricket wickets', async () => {
    await rejectsSql('23514', 'update cricket_innings set wickets = 11 where revision_id = $1', [revision]);
  });

  it('rejects duplicate fantasy entries', async () => {
    await rejectsSql('23505', 'insert into fantasy_entries (fantasy_league_id,tournament_id,user_id,name) values ($1,$2,$3,$4)', [fantasy, tournament, userId, 'Duplicate']);
  });

  it('counts transfers across rounds against one tournament allowance', async () => {
    await client.query('insert into fantasy_transfers (entry_id,fantasy_league_id,tournament_id,round_id,outgoing_player_id,incoming_player_id,sale_price,purchase_price,request_id) values ($1,$2,$3,$4,$5,$6,9.5,8.5,$7),($1,$2,$3,$8,$6,$5,8.5,9.5,$9)', [entry, fantasy, tournament, round1, rosterA, rosterB, id(), round2, id()]);
    const { rows } = await client.query('select r.transfer_limit, count(t.id)::int as used from fantasy_entries e join fantasy_leagues l on l.id=e.fantasy_league_id join fantasy_rule_sets r on r.id=l.rule_set_id left join fantasy_transfers t on t.entry_id=e.id where e.id=$1 group by r.transfer_limit', [entry]);
    expect(rows[0]).toEqual({ transfer_limit: 3, used: 2 });
  });

  it('joins published stats, policy weights and historical captain picks with exact decimals', async () => {
    const { rows } = await client.query('select (s.value * r.points_per_unit * p.captain_multiplier)::numeric(16,4) as points from player_match_stats s join fantasy_scoring_rules r on r.stat_definition_id=s.stat_definition_id join fantasy_rule_sets p on p.id=r.rule_set_id join fantasy_squad_picks pick on pick.tournament_player_id=s.tournament_player_id where s.revision_id=$1 and p.id=$2 and pick.squad_id=$3 and pick.is_captain', [revision, rules, squad]);
    expect(rows[0].points).toBe('100.0000');
    await client.query('insert into fantasy_entry_match_points (run_id,entry_id,squad_id,fantasy_league_id,tournament_id,round_id,points) values ($1,$2,$3,$4,$5,$6,$7)', [run, entry, squad, fantasy, tournament, round1, rows[0].points]);
  });

  it('rejects two current calculations for the same match and competition', async () => {
    await rejectsSql('23505', 'insert into scoring_runs (fantasy_league_id,tournament_id,match_id,round_id,revision_id,rule_set_id,engine_version,status,is_current,completed_at) values ($1,$2,$3,$4,$5,$6,$7,$8,true,now())', [fantasy, tournament, match, round1, revision, rules, 'other-engine', 'completed']);
  });

  it('rejects awarding a match to a squad from another round', async () => {
    await rejectsSql('23503', 'insert into fantasy_entry_match_points (run_id,entry_id,squad_id,fantasy_league_id,tournament_id,round_id,points) values ($1,$2,$3,$4,$5,$6,100)', [run, entry, laterSquad, fantasy, tournament, round1]);
  });
});
