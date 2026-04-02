import { boolean, integer, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { teams } from "./teams";

export const player_role_enum = pgEnum("roles", ['Batter', 'Bowler', 'All Rounder'])

export const players = pgTable("players", {
    id: uuid('id').primaryKey().defaultRandom(),
    team_id: uuid('team_id').notNull().references(()=> teams.id),
    name: varchar('name', {length: 50}).notNull(),
    age: varchar('age', {length: 2}),
    price: integer('price').notNull(),
    role: player_role_enum('role').notNull(),
    isActive:  boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
})