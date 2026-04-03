import { pgTable, uuid, varchar } from "drizzle-orm/pg-core";

export const teams = pgTable('teams', {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    code: varchar("code", {length: 5}).notNull().unique(),
    name: varchar("name").notNull().unique(),
    logo: varchar("logo").notNull()
})
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
