CREATE TABLE "cricket_plays" (
	"match_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"play" jsonb NOT NULL,
	"recorded_by" uuid NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	CONSTRAINT "cricket_plays_match_id_sequence_pk" PRIMARY KEY("match_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "cricket_scoring" (
	"match_id" uuid PRIMARY KEY NOT NULL,
	"overs" integer NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"correcting" boolean DEFAULT false NOT NULL,
	CONSTRAINT "cricket_scoring_overs_bounds" CHECK ("cricket_scoring"."overs" BETWEEN 1 AND 50)
);
--> statement-breakpoint
ALTER TABLE "match_stat_revisions" ADD COLUMN "cricket_card" jsonb;--> statement-breakpoint
ALTER TABLE "cricket_plays" ADD CONSTRAINT "cricket_plays_match_id_cricket_scoring_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."cricket_scoring"("match_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cricket_plays" ADD CONSTRAINT "cricket_plays_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cricket_plays" ADD CONSTRAINT "cricket_plays_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cricket_scoring" ADD CONSTRAINT "cricket_scoring_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;