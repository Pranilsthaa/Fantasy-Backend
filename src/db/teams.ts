import { leagues } from './leagues';
import { sql } from "drizzle-orm";
import { pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const teams = pgTable('teams', {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    code: varchar("code", {length: 5}).notNull(),
    name: varchar("name").notNull(),
    leagueId: uuid("league_id").references(() => leagues.id),
    logo: varchar("logo")
}, (t) => [
    uniqueIndex('teams_legacy_code_unique').on(t.code).where(sql`${t.leagueId} is null`),
    uniqueIndex('teams_legacy_name_unique').on(t.name).where(sql`${t.leagueId} is null`),
    uniqueIndex('teams_league_code_unique').on(t.leagueId, sql`lower(${t.code})`),
    uniqueIndex('teams_league_name_unique').on(t.leagueId, sql`lower(${t.name})`),
])
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
