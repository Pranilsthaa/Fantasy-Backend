import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, timestamp, unique, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';
import { tournaments, tournamentPlayers, tournamentRounds } from './tournaments';
import { matches } from './matches';
import { matchPlayers, matchStatRevisions, statDefinitions } from './statistics';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
export const squadStatus = pgEnum('squad_status', ['draft', 'locked']);
export const scoringRunStatus = pgEnum('scoring_run_status', ['pending', 'completed', 'failed']);
export type RoleLimits = Record<string, { min: number; max: number }>;

export const fantasyRuleSets = pgTable('fantasy_rule_sets', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id),
  name: varchar('name', { length: 100 }).notNull(),
  version: integer('version').notNull(),
  squadSize: integer('squad_size').notNull(),
  startingSize: integer('starting_size').notNull(),
  budget: numeric('budget', { precision: 12, scale: 2 }).notNull(),
  maxPerTeam: integer('max_per_team').notNull(),
  transferLimit: integer('transfer_limit').notNull(),
  captainMultiplier: numeric('captain_multiplier', { precision: 6, scale: 2 }).notNull(),
  roleLimits: jsonb('role_limits').$type<RoleLimits>().notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  unique('fantasy_rule_sets_version_unique').on(t.tournamentId, t.name, t.version),
  unique('fantasy_rule_sets_scope_unique').on(t.id, t.tournamentId),
  check('fantasy_rule_sets_bounds', sql`${t.version} > 0 AND ${t.squadSize} > 0 AND ${t.startingSize} > 0 AND ${t.startingSize} <= ${t.squadSize} AND ${t.budget} >= 0 AND ${t.maxPerTeam} > 0 AND ${t.maxPerTeam} <= ${t.squadSize} AND ${t.transferLimit} >= 0 AND ${t.captainMultiplier} >= 1`),
  check('fantasy_rule_sets_roles_object', sql`jsonb_typeof(${t.roleLimits}) = 'object'`),
]);

export const fantasyScoringRules = pgTable('fantasy_scoring_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  ruleSetId: uuid('rule_set_id').notNull().references(() => fantasyRuleSets.id),
  statDefinitionId: uuid('stat_definition_id').notNull().references(() => statDefinitions.id),
  pointsPerUnit: numeric('points_per_unit', { precision: 12, scale: 4 }).notNull(),
  minimum: numeric('minimum', { precision: 16, scale: 4 }),
  maximum: numeric('maximum', { precision: 16, scale: 4 }),
}, (t) => [
  index('fantasy_scoring_rules_ruleset_idx').on(t.ruleSetId),
  check('fantasy_scoring_rules_range', sql`${t.minimum} IS NULL OR ${t.maximum} IS NULL OR ${t.maximum} >= ${t.minimum}`),
]);

export const fantasyLeagues = pgTable('fantasy_leagues', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id),
  ruleSetId: uuid('rule_set_id').notNull(),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  name: varchar('name', { length: 150 }).notNull(),
  createdAt: createdAt(),
}, (t) => [
  unique('fantasy_leagues_scope_unique').on(t.id, t.tournamentId),
  unique('fantasy_leagues_policy_unique').on(t.id, t.tournamentId, t.ruleSetId),
  foreignKey({ name: 'fantasy_leagues_scope_1_fk', columns: [t.ruleSetId, t.tournamentId], foreignColumns: [fantasyRuleSets.id, fantasyRuleSets.tournamentId] }),
  index('fantasy_leagues_tournament_idx').on(t.tournamentId),
  index('fantasy_leagues_owner_idx').on(t.ownerId),
]);

export const fantasyInvitations = pgTable('fantasy_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  fantasyLeagueId: uuid('fantasy_league_id').notNull().references(() => fantasyLeagues.id),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  email: varchar('email', { length: 255 }),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  maxUses: integer('max_uses').notNull().default(1),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  unique('fantasy_invitations_scope_unique').on(t.id, t.fantasyLeagueId),
  check('fantasy_invitations_max_uses_positive', sql`${t.maxUses} > 0`),
  check('fantasy_invitations_expiry', sql`${t.expiresAt} > ${t.createdAt}`),
  index('fantasy_invitations_league_idx').on(t.fantasyLeagueId),
]);

export const fantasyEntries = pgTable('fantasy_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  fantasyLeagueId: uuid('fantasy_league_id').notNull(),
  tournamentId: uuid('tournament_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  invitationId: uuid('invitation_id'),
  name: varchar('name', { length: 100 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
}, (t) => [
  unique('fantasy_entries_user_unique').on(t.fantasyLeagueId, t.userId),
  unique('fantasy_entries_scope_unique').on(t.id, t.fantasyLeagueId, t.tournamentId),
  foreignKey({ name: 'fantasy_entries_scope_1_fk', columns: [t.fantasyLeagueId, t.tournamentId], foreignColumns: [fantasyLeagues.id, fantasyLeagues.tournamentId] }),
  foreignKey({ name: 'fantasy_entries_scope_2_fk', columns: [t.invitationId, t.fantasyLeagueId], foreignColumns: [fantasyInvitations.id, fantasyInvitations.fantasyLeagueId] }),
  index('fantasy_entries_user_idx').on(t.userId),
  index('fantasy_entries_invitation_idx').on(t.invitationId),
]);

export const fantasySquads = pgTable('fantasy_squads', {
  id: uuid('id').primaryKey().defaultRandom(),
  entryId: uuid('entry_id').notNull(),
  fantasyLeagueId: uuid('fantasy_league_id').notNull(),
  tournamentId: uuid('tournament_id').notNull(),
  roundId: uuid('round_id').notNull(),
  status: squadStatus('status').notNull().default('draft'),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  unique('fantasy_squads_entry_round_unique').on(t.entryId, t.roundId),
  unique('fantasy_squads_scope_unique').on(t.id, t.tournamentId),
  unique('fantasy_squads_result_scope_unique').on(t.id, t.entryId, t.fantasyLeagueId, t.tournamentId, t.roundId),
  foreignKey({ name: 'fantasy_squads_scope_1_fk', columns: [t.entryId, t.fantasyLeagueId, t.tournamentId], foreignColumns: [fantasyEntries.id, fantasyEntries.fantasyLeagueId, fantasyEntries.tournamentId] }),
  foreignKey({ name: 'fantasy_squads_scope_2_fk', columns: [t.roundId, t.tournamentId], foreignColumns: [tournamentRounds.id, tournamentRounds.tournamentId] }),
  check('fantasy_squads_lock_time', sql`(${t.status} = 'locked') = (${t.lockedAt} IS NOT NULL)`),
  index('fantasy_squads_round_idx').on(t.roundId, t.tournamentId),
]);

export const fantasySquadPicks = pgTable('fantasy_squad_picks', {
  squadId: uuid('squad_id').notNull(),
  tournamentId: uuid('tournament_id').notNull(),
  tournamentPlayerId: uuid('tournament_player_id').notNull(),
  slot: integer('slot').notNull(),
  purchasePrice: numeric('purchase_price', { precision: 12, scale: 2 }).notNull(),
  isStarting: boolean('is_starting').notNull(),
  isCaptain: boolean('is_captain').notNull().default(false),
  isViceCaptain: boolean('is_vice_captain').notNull().default(false),
}, (t) => [
  primaryKey({ name: 'fantasy_squad_picks_pk', columns: [t.squadId, t.tournamentPlayerId] }),
  unique('fantasy_squad_picks_slot_unique').on(t.squadId, t.slot),
  foreignKey({ name: 'fantasy_squad_picks_scope_1_fk', columns: [t.squadId, t.tournamentId], foreignColumns: [fantasySquads.id, fantasySquads.tournamentId] }),
  foreignKey({ name: 'fantasy_squad_picks_scope_2_fk', columns: [t.tournamentPlayerId, t.tournamentId], foreignColumns: [tournamentPlayers.id, tournamentPlayers.tournamentId] }),
  uniqueIndex('fantasy_squad_picks_one_captain').on(t.squadId).where(sql`${t.isCaptain}`),
  uniqueIndex('fantasy_squad_picks_one_vice_captain').on(t.squadId).where(sql`${t.isViceCaptain}`),
  check('fantasy_squad_picks_valid', sql`${t.slot} > 0 AND ${t.purchasePrice} >= 0 AND NOT (${t.isCaptain} AND ${t.isViceCaptain}) AND (NOT (${t.isCaptain} OR ${t.isViceCaptain}) OR ${t.isStarting})`),
  index('fantasy_squad_picks_player_idx').on(t.tournamentPlayerId, t.tournamentId),
]);

export const fantasyTransfers = pgTable('fantasy_transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  entryId: uuid('entry_id').notNull(),
  fantasyLeagueId: uuid('fantasy_league_id').notNull(),
  tournamentId: uuid('tournament_id').notNull(),
  roundId: uuid('round_id').notNull(),
  outgoingPlayerId: uuid('outgoing_player_id').notNull(),
  incomingPlayerId: uuid('incoming_player_id').notNull(),
  salePrice: numeric('sale_price', { precision: 12, scale: 2 }).notNull(),
  purchasePrice: numeric('purchase_price', { precision: 12, scale: 2 }).notNull(),
  requestId: uuid('request_id').notNull(),
  createdAt: createdAt(),
}, (t) => [
  unique('fantasy_transfers_request_unique').on(t.entryId, t.requestId),
  foreignKey({ name: 'fantasy_transfers_scope_1_fk', columns: [t.entryId, t.fantasyLeagueId, t.tournamentId], foreignColumns: [fantasyEntries.id, fantasyEntries.fantasyLeagueId, fantasyEntries.tournamentId] }),
  foreignKey({ name: 'fantasy_transfers_scope_2_fk', columns: [t.roundId, t.tournamentId], foreignColumns: [tournamentRounds.id, tournamentRounds.tournamentId] }),
  foreignKey({ name: 'fantasy_transfers_scope_3_fk', columns: [t.outgoingPlayerId, t.tournamentId], foreignColumns: [tournamentPlayers.id, tournamentPlayers.tournamentId] }),
  foreignKey({ name: 'fantasy_transfers_scope_4_fk', columns: [t.incomingPlayerId, t.tournamentId], foreignColumns: [tournamentPlayers.id, tournamentPlayers.tournamentId] }),
  check('fantasy_transfers_valid', sql`${t.outgoingPlayerId} <> ${t.incomingPlayerId} AND ${t.salePrice} >= 0 AND ${t.purchasePrice} >= 0`),
  index('fantasy_transfers_usage_idx').on(t.entryId, t.createdAt),
]);

export const scoringRuns = pgTable('scoring_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  fantasyLeagueId: uuid('fantasy_league_id').notNull(),
  tournamentId: uuid('tournament_id').notNull(),
  matchId: uuid('match_id').notNull(),
  roundId: uuid('round_id').notNull(),
  revisionId: uuid('revision_id').notNull(),
  ruleSetId: uuid('rule_set_id').notNull(),
  engineVersion: varchar('engine_version', { length: 50 }).notNull(),
  status: scoringRunStatus('status').notNull().default('pending'),
  isCurrent: boolean('is_current').notNull().default(false),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('scoring_runs_one_current').on(t.fantasyLeagueId, t.matchId).where(sql`${t.isCurrent}`),
  check('scoring_runs_current_completed', sql`NOT ${t.isCurrent} OR ${t.status} = 'completed'`),
  unique('scoring_runs_calculation_unique').on(t.fantasyLeagueId, t.matchId, t.revisionId, t.ruleSetId, t.engineVersion),
  unique('scoring_runs_match_scope_unique').on(t.id, t.matchId, t.tournamentId),
  unique('scoring_runs_entry_scope_unique').on(t.id, t.fantasyLeagueId, t.tournamentId, t.roundId),
  foreignKey({ name: 'scoring_runs_scope_1_fk', columns: [t.fantasyLeagueId, t.tournamentId, t.ruleSetId], foreignColumns: [fantasyLeagues.id, fantasyLeagues.tournamentId, fantasyLeagues.ruleSetId] }),
  foreignKey({ name: 'scoring_runs_scope_2_fk', columns: [t.matchId, t.tournamentId, t.roundId], foreignColumns: [matches.id, matches.tournamentId, matches.roundId] }),
  foreignKey({ name: 'scoring_runs_scope_3_fk', columns: [t.revisionId, t.matchId, t.tournamentId], foreignColumns: [matchStatRevisions.id, matchStatRevisions.matchId, matchStatRevisions.tournamentId] }),
  check('scoring_runs_completion_time', sql`(${t.status} = 'completed') = (${t.completedAt} IS NOT NULL)`),
  index('scoring_runs_leaderboard_idx').on(t.fantasyLeagueId, t.status, t.matchId),
]);

export const playerMatchPoints = pgTable('player_match_points', {
  runId: uuid('run_id').notNull(),
  matchId: uuid('match_id').notNull(),
  tournamentId: uuid('tournament_id').notNull(),
  tournamentPlayerId: uuid('tournament_player_id').notNull(),
  points: numeric('points', { precision: 16, scale: 4 }).notNull(),
  breakdown: jsonb('breakdown').$type<Record<string, string>>().notNull(),
}, (t) => [
  primaryKey({ name: 'player_match_points_pk', columns: [t.runId, t.tournamentPlayerId] }),
  foreignKey({ name: 'player_match_points_scope_1_fk', columns: [t.runId, t.matchId, t.tournamentId], foreignColumns: [scoringRuns.id, scoringRuns.matchId, scoringRuns.tournamentId] }),
  foreignKey({ name: 'player_match_points_scope_2_fk', columns: [t.matchId, t.tournamentPlayerId, t.tournamentId], foreignColumns: [matchPlayers.matchId, matchPlayers.tournamentPlayerId, matchPlayers.tournamentId] }),
]);

export const fantasyEntryMatchPoints = pgTable('fantasy_entry_match_points', {
  runId: uuid('run_id').notNull(),
  entryId: uuid('entry_id').notNull(),
  squadId: uuid('squad_id').notNull(),
  fantasyLeagueId: uuid('fantasy_league_id').notNull(),
  tournamentId: uuid('tournament_id').notNull(),
  roundId: uuid('round_id').notNull(),
  points: numeric('points', { precision: 16, scale: 4 }).notNull(),
}, (t) => [
  primaryKey({ name: 'fantasy_entry_match_points_pk', columns: [t.runId, t.entryId] }),
  foreignKey({ name: 'fantasy_entry_match_points_scope_1_fk', columns: [t.runId, t.fantasyLeagueId, t.tournamentId, t.roundId], foreignColumns: [scoringRuns.id, scoringRuns.fantasyLeagueId, scoringRuns.tournamentId, scoringRuns.roundId] }),
  foreignKey({ name: 'fantasy_entry_match_points_scope_2_fk', columns: [t.squadId, t.entryId, t.fantasyLeagueId, t.tournamentId, t.roundId], foreignColumns: [fantasySquads.id, fantasySquads.entryId, fantasySquads.fantasyLeagueId, fantasySquads.tournamentId, fantasySquads.roundId] }),
  index('fantasy_entry_match_points_entry_idx').on(t.entryId),
]);
