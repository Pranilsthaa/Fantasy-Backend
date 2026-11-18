import { leagues } from './leagues';
export { leagues } from './leagues';
import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, integer, numeric, pgEnum, pgTable, primaryKey, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';
import { teams } from './teams';
import { players } from './players';

export const leagueMemberRole = pgEnum('league_member_role', ['admin', 'scorer']);
export const tournamentStatus = pgEnum('tournament_status', ['draft', 'open', 'live', 'completed', 'archived']);
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const leagueMembers = pgTable('league_members', {
  leagueId: uuid('league_id').notNull().references(() => leagues.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: leagueMemberRole('role').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
}, (t) => [primaryKey({ name: 'league_members_pk', columns: [t.leagueId, t.userId] }), index('league_members_user_idx').on(t.userId)]);

export const tournaments = pgTable('tournaments', {
  id: uuid('id').primaryKey().defaultRandom(),
  leagueId: uuid('league_id').notNull().references(() => leagues.id),
  name: varchar('name', { length: 150 }).notNull(),
  season: varchar('season', { length: 50 }).notNull(),
  status: tournamentStatus('status').notNull().default('draft'),
  timezone: varchar('timezone', { length: 80 }).notNull().default('Asia/Kathmandu'),
  schedulePublishedAt: timestamp('schedule_published_at', { withTimezone: true }),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  unique('tournaments_league_season_unique').on(t.leagueId, t.season),
  check('tournaments_date_order', sql`${t.endsAt} IS NULL OR ${t.startsAt} IS NULL OR ${t.endsAt} >= ${t.startsAt}`),
]);

export const tournamentTeams = pgTable('tournament_teams', {
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id),
  teamId: uuid('team_id').notNull().references(() => teams.id),
  createdAt: createdAt(),
}, (t) => [primaryKey({ name: 'tournament_teams_pk', columns: [t.tournamentId, t.teamId] }), index('tournament_teams_team_idx').on(t.teamId)]);

export const tournamentPlayers = pgTable('tournament_players', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id),
  playerId: uuid('player_id').notNull().references(() => players.id),
  teamId: uuid('team_id').notNull(),
  role: varchar('role', { length: 30 }).notNull(),
  price: numeric('price', { precision: 12, scale: 2 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
}, (t) => [
  unique('tournament_players_player_unique').on(t.tournamentId, t.playerId),
  unique('tournament_players_scope_unique').on(t.id, t.tournamentId),
  foreignKey({ name: 'tournament_players_scope_1_fk', columns: [t.tournamentId, t.teamId], foreignColumns: [tournamentTeams.tournamentId, tournamentTeams.teamId] }),
  check('tournament_players_price_nonnegative', sql`${t.price} >= 0`),
  index('tournament_players_team_idx').on(t.tournamentId, t.teamId),
  index('tournament_players_player_idx').on(t.playerId),
]);

export const tournamentRounds = pgTable('tournament_rounds', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id),
  number: integer('number').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  deadline: timestamp('deadline', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (t) => [
  unique('tournament_rounds_number_unique').on(t.tournamentId, t.number),
  unique('tournament_rounds_scope_unique').on(t.id, t.tournamentId),
  check('tournament_rounds_number_positive', sql`${t.number} > 0`),
  index('tournament_rounds_deadline_idx').on(t.tournamentId, t.deadline),
]);
