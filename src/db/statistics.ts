import { sql } from 'drizzle-orm';
import { check, foreignKey, index, integer, numeric, pgEnum, pgTable, primaryKey, timestamp, unique, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { matches } from './matches';
import { tournamentPlayers, tournamentTeams } from './tournaments';
import { users } from './users';

export const statRevisionStatus = pgEnum('stat_revision_status', ['draft', 'published', 'superseded']);

export const statDefinitions = pgTable('stat_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sport: varchar('sport', { length: 40 }).notNull(),
  key: varchar('key', { length: 80 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  unit: varchar('unit', { length: 30 }).notNull().default('count'),
}, (t) => [unique('stat_definitions_sport_key_unique').on(t.sport, t.key)]);

export const matchPlayers = pgTable('match_players', {
  matchId: uuid('match_id').notNull(),
  tournamentId: uuid('tournament_id').notNull(),
  tournamentPlayerId: uuid('tournament_player_id').notNull(),
}, (t) => [
  primaryKey({ name: 'match_players_pk', columns: [t.matchId, t.tournamentPlayerId] }),
  unique('match_players_scope_unique').on(t.matchId, t.tournamentPlayerId, t.tournamentId),
  foreignKey({ name: 'match_players_scope_1_fk', columns: [t.matchId, t.tournamentId], foreignColumns: [matches.id, matches.tournamentId] }),
  foreignKey({ name: 'match_players_scope_2_fk', columns: [t.tournamentPlayerId, t.tournamentId], foreignColumns: [tournamentPlayers.id, tournamentPlayers.tournamentId] }),
  index('match_players_registration_idx').on(t.tournamentPlayerId, t.tournamentId),
]);

export const matchStatRevisions = pgTable('match_stat_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchId: uuid('match_id').notNull(),
  tournamentId: uuid('tournament_id').notNull(),
  revision: integer('revision').notNull(),
  status: statRevisionStatus('status').notNull().default('draft'),
  submittedBy: uuid('submitted_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
}, (t) => [
  unique('match_stat_revisions_number_unique').on(t.matchId, t.revision),
  unique('match_stat_revisions_scope_unique').on(t.id, t.matchId, t.tournamentId),
  foreignKey({ name: 'match_stat_revisions_scope_1_fk', columns: [t.matchId, t.tournamentId], foreignColumns: [matches.id, matches.tournamentId] }),
  uniqueIndex('match_stat_revisions_one_published').on(t.matchId).where(sql`${t.status} = 'published'`),
  check('match_stat_revisions_number_positive', sql`${t.revision} > 0`),
  check('match_stat_revisions_publication_time', sql`${t.status} = 'draft' OR ${t.publishedAt} IS NOT NULL`),
]);

export const playerMatchStats = pgTable('player_match_stats', {
  revisionId: uuid('revision_id').notNull(),
  matchId: uuid('match_id').notNull(),
  tournamentId: uuid('tournament_id').notNull(),
  tournamentPlayerId: uuid('tournament_player_id').notNull(),
  statDefinitionId: uuid('stat_definition_id').notNull().references(() => statDefinitions.id),
  value: numeric('value', { precision: 16, scale: 4 }).notNull(),
}, (t) => [
  primaryKey({ name: 'player_match_stats_pk', columns: [t.revisionId, t.tournamentPlayerId, t.statDefinitionId] }),
  foreignKey({ name: 'player_match_stats_scope_1_fk', columns: [t.revisionId, t.matchId, t.tournamentId], foreignColumns: [matchStatRevisions.id, matchStatRevisions.matchId, matchStatRevisions.tournamentId] }),
  foreignKey({ name: 'player_match_stats_scope_2_fk', columns: [t.matchId, t.tournamentPlayerId, t.tournamentId], foreignColumns: [matchPlayers.matchId, matchPlayers.tournamentPlayerId, matchPlayers.tournamentId] }),
  check('player_match_stats_value_nonnegative', sql`${t.value} >= 0`),
  index('player_match_stats_player_idx').on(t.tournamentPlayerId, t.statDefinitionId),
]);

// Cricket uses legal balls, never decimal "overs" (19.5 means 119 balls).
// The same published stat revision owns both scorecard and player observations.
export const cricketInnings = pgTable('cricket_innings', {
  revisionId: uuid('revision_id').notNull(),
  matchId: uuid('match_id').notNull(),
  tournamentId: uuid('tournament_id').notNull(),
  number: integer('number').notNull(),
  battingTeamId: uuid('batting_team_id').notNull(),
  bowlingTeamId: uuid('bowling_team_id').notNull(),
  runs: integer('runs').notNull(),
  wickets: integer('wickets').notNull(),
  legalBalls: integer('legal_balls').notNull(),
  extras: integer('extras').notNull(),
}, (t) => [
  primaryKey({ name: 'cricket_innings_pk', columns: [t.revisionId, t.number] }),
  foreignKey({ name: 'cricket_innings_scope_1_fk', columns: [t.revisionId, t.matchId, t.tournamentId], foreignColumns: [matchStatRevisions.id, matchStatRevisions.matchId, matchStatRevisions.tournamentId] }),
  foreignKey({ name: 'cricket_innings_scope_2_fk', columns: [t.tournamentId, t.battingTeamId], foreignColumns: [tournamentTeams.tournamentId, tournamentTeams.teamId] }),
  foreignKey({ name: 'cricket_innings_scope_3_fk', columns: [t.tournamentId, t.bowlingTeamId], foreignColumns: [tournamentTeams.tournamentId, tournamentTeams.teamId] }),
  check('cricket_innings_values', sql`${t.number} > 0 AND ${t.runs} >= 0 AND ${t.wickets} BETWEEN 0 AND 10 AND ${t.legalBalls} >= 0 AND ${t.extras} BETWEEN 0 AND ${t.runs} AND ${t.battingTeamId} <> ${t.bowlingTeamId}`),
]);

export const matchOutcome = pgEnum('match_outcome', ['team_win', 'tie', 'no_result', 'draw']);
export const matchResults = pgTable('match_results', {
  revisionId: uuid('revision_id').primaryKey(),
  matchId: uuid('match_id').notNull(),
  tournamentId: uuid('tournament_id').notNull(),
  outcome: matchOutcome('outcome').notNull(),
  winnerTeamId: uuid('winner_team_id'),
  summary: varchar('summary', { length: 300 }),
}, (t) => [
  foreignKey({ name: 'match_results_scope_1_fk', columns: [t.revisionId, t.matchId, t.tournamentId], foreignColumns: [matchStatRevisions.id, matchStatRevisions.matchId, matchStatRevisions.tournamentId] }),
  foreignKey({ name: 'match_results_scope_2_fk', columns: [t.tournamentId, t.winnerTeamId], foreignColumns: [tournamentTeams.tournamentId, tournamentTeams.teamId] }),
  check('match_results_winner', sql`(${t.outcome} = 'team_win') = (${t.winnerTeamId} IS NOT NULL)`),
]);
