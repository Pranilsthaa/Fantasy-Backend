ALTER TABLE "teams" DROP CONSTRAINT "teams_code_unique";--> statement-breakpoint
ALTER TABLE "teams" DROP CONSTRAINT "teams_name_unique";--> statement-breakpoint
ALTER TABLE "tournament_players" ALTER COLUMN "price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ALTER COLUMN "team_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ALTER COLUMN "price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "logo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "league_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "league_id" uuid;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "players_league_idx" ON "players" USING btree ("league_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_legacy_code_unique" ON "teams" USING btree ("code") WHERE "teams"."league_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "teams_legacy_name_unique" ON "teams" USING btree ("name") WHERE "teams"."league_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "teams_league_code_unique" ON "teams" USING btree ("league_id",lower("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "teams_league_name_unique" ON "teams" USING btree ("league_id",lower("name"));