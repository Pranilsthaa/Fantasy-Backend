ALTER TABLE "matches" DROP CONSTRAINT "matches_round_scope";--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "schedule_published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_round_scope" CHECK ("matches"."round_id" IS NULL OR "matches"."tournament_id" IS NOT NULL);