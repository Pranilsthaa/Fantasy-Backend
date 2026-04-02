// DATABASE_URL=postgres://bright:@localhost:5432/test

import { pgTable, uuid, varchar, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
// import { relations } from 'drizzle-orm';
// import { squads } from './squads';
// import { transfers } from './transfers';
// import { points } from './points';

// ── Enums ──────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

// ── Table ──────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  username:     varchar('username', { length: 50 }).notNull().unique(),
  email:        varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role:         userRoleEnum('role').notNull().default('user'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
});

// // ── Relations ──────────────────────────────────────────────────────────────
// export const usersRelations = relations(users, ({ one, many }) => ({
//   squad:     one(squads, { fields: [users.id], references: [squads.userId] }),
//   transfers: many(transfers),
//   points:    many(points),
// }));

// ── Types ──────────────────────────────────────────────────────────────────
export type User        = typeof users.$inferSelect;
export type NewUser     = typeof users.$inferInsert;
export type UserRole    = (typeof userRoleEnum.enumValues)[number];