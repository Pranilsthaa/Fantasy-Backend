import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';

// Exercise real Nest routing, dependency injection, services and serialization.
// Only the database boundary is replaced; no PostgreSQL server is needed.
describe('Fantasy API', () => {
  let app: INestApplication;
  let baseUrl: string;
  const findPlayers = mock(async (_options: unknown): Promise<unknown[]> => []);
  const findMatches = mock(async (_options: unknown): Promise<unknown[]> => []);

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue({ db: { query: {
        players: { findMany: findPlayers },
        matches: { findMany: findMatches },
      } } })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  beforeEach(() => {
    findPlayers.mockReset();
    findMatches.mockReset();
    findPlayers.mockResolvedValue([]);
    findMatches.mockResolvedValue([]);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('preserves the root response', async () => {
    const response = await fetch(baseUrl);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Fantasy API is running');
  });

  it('returns 404 for an unknown route', async () => {
    expect((await fetch(`${baseUrl}/api/missing`)).status).toBe(404);
  });

  for (const [resource, title, query, row] of [
    ['players', 'Players', findPlayers, {
      id: 'player-1', name: 'Player', age: '25', price: 10,
      role: 'BAT', isActive: true,
      team: { name: 'Team', logo: 'logo.png', code: 'TM' },
    }],
    ['matches', 'Matches', findMatches, {
      id: 'match-1', matchNumber: 1, date: new Date('2026-04-22T19:30:00Z'),
      venue: 'Stadium', status: 'upcoming',
      team1: { name: 'One', logo: 'one.png', code: 'ONE' },
      team2: { name: 'Two', logo: 'two.png', code: 'TWO' },
    }],
  ] as const) {
    it(`preserves ${resource} data and response envelope`, async () => {
      query.mockResolvedValueOnce([row]);
      const response = await fetch(`${baseUrl}/api/${resource}`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        success: true, message: `${title} fetched successfully`,
        data: JSON.parse(JSON.stringify([row])),
      });
      // Keep database projection and joined team fields in the public contract.
      expect(query.mock.calls[0]?.[0]).toMatchObject(resource === 'players' ? {
        columns: { id: true, name: true, age: true, price: true, role: true, isActive: true },
        with: { team: { columns: { name: true, logo: true, code: true } } },
      } : {
        columns: { id: true, matchNumber: true, date: true, venue: true, status: true },
        with: {
          team1: { columns: { name: true, logo: true, code: true } },
          team2: { columns: { name: true, logo: true, code: true } },
        },
      });
    });

    it(`returns an empty ${resource} list`, async () => {
      const response = await fetch(`${baseUrl}/api/${resource}/`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        success: true, message: `${title} fetched successfully`, data: [],
      });
    });

    it(`preserves ${resource} database failure responses without leaking details`, async () => {
      query.mockImplementationOnce(async () => { throw new Error('private database details'); });
      const response = await fetch(`${baseUrl}/api/${resource}`);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ success: false, message: 'Internal server error' });
    });
  }
});
