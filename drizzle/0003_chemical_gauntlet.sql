ALTER TABLE "players" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."roles";--> statement-breakpoint
CREATE TYPE "public"."roles" AS ENUM('BAT', 'BWL', 'AR', 'WK');--> statement-breakpoint
ALTER TABLE "players" ALTER COLUMN "role" SET DATA TYPE "public"."roles" USING "role"::"public"."roles";