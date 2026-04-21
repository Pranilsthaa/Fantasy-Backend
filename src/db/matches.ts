import { integer, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { teams } from "./teams";

export const matchStatusEnum = pgEnum('match_status', [
  'upcoming',   // Not yet started, substitutions open
  'locked',     // Deadline passed, subs closed
  'live',       // Currently in progress
  'completed',  // Finished, points calculated
  'cancelled',  // Abandoned / no result
]);

export const matches = pgTable('matches', {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    matchNumber: integer('match_number').notNull().unique(),
    team1_id: uuid("team1_id").notNull().references(()=> teams.id),
    team2_id: uuid("team2_id").notNull().references(()=> teams.id),
    venue: varchar("venue", {length: 50}).notNull(),
    date: timestamp("date", {withTimezone: true}).notNull(),
    status: matchStatusEnum("status").notNull().default('upcoming'),
})