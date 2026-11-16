import { check, foreignKey, index, integer, pgEnum, pgTable, timestamp, unique, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { teams } from "./teams";
import { relations, sql } from "drizzle-orm";

import { tournamentRounds, tournaments, tournamentTeams } from './tournaments';

export const matchStatusEnum = pgEnum('match_status', [
  'upcoming',   // Not yet started, substitutions open
  'locked',     // Deadline passed, subs closed
  'live',       // Currently in progress
  'completed',  // Finished, points calculated
  'cancelled',  // Abandoned / no result
]);

export const matches = pgTable('matches', {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    matchNumber: integer('match_number').notNull(),
    tournamentId: uuid('tournament_id').references(() => tournaments.id),
    roundId: uuid('round_id'),
    team1_id: uuid("team1_id").notNull().references(()=> teams.id),
    team2_id: uuid("team2_id").notNull().references(()=> teams.id),
    venue: varchar("venue", {length: 50}).notNull(),
    date: timestamp("date", {withTimezone: true}).notNull(),
    status: matchStatusEnum("status").notNull().default('upcoming'),
}, (t) => [
    unique('matches_scope_unique').on(t.id, t.tournamentId),
    unique('matches_round_scope_unique').on(t.id, t.tournamentId, t.roundId),
    unique('matches_tournament_number_unique').on(t.tournamentId, t.matchNumber),
    uniqueIndex('matches_legacy_number_unique').on(t.matchNumber).where(sql`${t.tournamentId} IS NULL`),
    foreignKey({ name: 'matches_scope_1_fk', columns: [t.roundId, t.tournamentId], foreignColumns: [tournamentRounds.id, tournamentRounds.tournamentId] }),
    foreignKey({ name: 'matches_scope_2_fk', columns: [t.tournamentId, t.team1_id], foreignColumns: [tournamentTeams.tournamentId, tournamentTeams.teamId] }),
    foreignKey({ name: 'matches_scope_3_fk', columns: [t.tournamentId, t.team2_id], foreignColumns: [tournamentTeams.tournamentId, tournamentTeams.teamId] }),
    check('matches_distinct_teams', sql`${t.team1_id} <> ${t.team2_id}`),
    check('matches_round_scope', sql`(${t.tournamentId} IS NULL) = (${t.roundId} IS NULL)`),
    index('matches_tournament_schedule_idx').on(t.tournamentId, t.date),
    index('matches_round_idx').on(t.roundId, t.tournamentId),
]);

export const matchesRelations = relations(matches, ({one}) => ({
    team1: one(teams, {
        fields: [matches.team1_id],
        references: [teams.id],
    }),
    team2: one(teams, {
        fields: [matches.team2_id],
        references: [teams.id],
    }),
}));
