import { sql } from 'drizzle-orm';
import { boolean, check, integer, jsonb, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { Play } from '../module/leagues/scoring/cricket';
import { matches } from './matches';
import { users } from './users';

export const cricketScoring = pgTable('cricket_scoring', {
  matchId: uuid('match_id').primaryKey().references(() => matches.id),
  overs: integer('overs').notNull(),
  version: integer('version').notNull().default(0),
  correcting: boolean('correcting').notNull().default(false),
}, (t) => [check('cricket_scoring_overs_bounds', sql`${t.overs} BETWEEN 1 AND 50`)]);

export const cricketPlays = pgTable('cricket_plays', {
  matchId: uuid('match_id').notNull().references(() => cricketScoring.matchId),
  sequence: integer('sequence').notNull(),
  play: jsonb('play').$type<Play>().notNull(),
  recordedBy: uuid('recorded_by').notNull().references(() => users.id),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidedBy: uuid('voided_by').references(() => users.id),
}, (t) => [primaryKey({ columns: [t.matchId, t.sequence] })]);
