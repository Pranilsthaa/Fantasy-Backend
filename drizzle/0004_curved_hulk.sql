CREATE TYPE "public"."league_member_role" AS ENUM('admin', 'scorer');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('draft', 'open', 'live', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."match_outcome" AS ENUM('team_win', 'tie', 'no_result', 'draw');--> statement-breakpoint
CREATE TYPE "public"."stat_revision_status" AS ENUM('draft', 'published', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."scoring_run_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."squad_status" AS ENUM('draft', 'locked');--> statement-breakpoint
CREATE TABLE "league_members" (
	"league_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "league_member_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "league_members_pk" PRIMARY KEY("league_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(150) NOT NULL,
	"sport" varchar(40) DEFAULT 'cricket' NOT NULL,
	"location" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leagues_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tournament_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"role" varchar(30) NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_players_player_unique" UNIQUE("tournament_id","player_id"),
	CONSTRAINT "tournament_players_scope_unique" UNIQUE("id","tournament_id"),
	CONSTRAINT "tournament_players_price_nonnegative" CHECK ("tournament_players"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tournament_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_rounds_number_unique" UNIQUE("tournament_id","number"),
	CONSTRAINT "tournament_rounds_scope_unique" UNIQUE("id","tournament_id"),
	CONSTRAINT "tournament_rounds_number_positive" CHECK ("tournament_rounds"."number" > 0)
);
--> statement-breakpoint
CREATE TABLE "tournament_teams" (
	"tournament_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_teams_pk" PRIMARY KEY("tournament_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"season" varchar(50) NOT NULL,
	"status" "tournament_status" DEFAULT 'draft' NOT NULL,
	"timezone" varchar(80) DEFAULT 'Asia/Kathmandu' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournaments_league_season_unique" UNIQUE("league_id","season"),
	CONSTRAINT "tournaments_date_order" CHECK ("tournaments"."ends_at" IS NULL OR "tournaments"."starts_at" IS NULL OR "tournaments"."ends_at" >= "tournaments"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "cricket_innings" (
	"revision_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"tournament_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"batting_team_id" uuid NOT NULL,
	"bowling_team_id" uuid NOT NULL,
	"runs" integer NOT NULL,
	"wickets" integer NOT NULL,
	"legal_balls" integer NOT NULL,
	"extras" integer NOT NULL,
	CONSTRAINT "cricket_innings_pk" PRIMARY KEY("revision_id","number"),
	CONSTRAINT "cricket_innings_values" CHECK ("cricket_innings"."number" > 0 AND "cricket_innings"."runs" >= 0 AND "cricket_innings"."wickets" BETWEEN 0 AND 10 AND "cricket_innings"."legal_balls" >= 0 AND "cricket_innings"."extras" BETWEEN 0 AND "cricket_innings"."runs" AND "cricket_innings"."batting_team_id" <> "cricket_innings"."bowling_team_id")
);
--> statement-breakpoint
CREATE TABLE "match_players" (
	"match_id" uuid NOT NULL,
	"tournament_id" uuid NOT NULL,
	"tournament_player_id" uuid NOT NULL,
	CONSTRAINT "match_players_pk" PRIMARY KEY("match_id","tournament_player_id"),
	CONSTRAINT "match_players_scope_unique" UNIQUE("match_id","tournament_player_id","tournament_id")
);
--> statement-breakpoint
CREATE TABLE "match_results" (
	"revision_id" uuid PRIMARY KEY NOT NULL,
	"match_id" uuid NOT NULL,
	"tournament_id" uuid NOT NULL,
	"outcome" "match_outcome" NOT NULL,
	"winner_team_id" uuid,
	"summary" varchar(300),
	CONSTRAINT "match_results_winner" CHECK (("match_results"."outcome" = 'team_win') = ("match_results"."winner_team_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "match_stat_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"tournament_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"status" "stat_revision_status" DEFAULT 'draft' NOT NULL,
	"submitted_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "match_stat_revisions_number_unique" UNIQUE("match_id","revision"),
	CONSTRAINT "match_stat_revisions_scope_unique" UNIQUE("id","match_id","tournament_id"),
	CONSTRAINT "match_stat_revisions_number_positive" CHECK ("match_stat_revisions"."revision" > 0),
	CONSTRAINT "match_stat_revisions_publication_time" CHECK ("match_stat_revisions"."status" = 'draft' OR "match_stat_revisions"."published_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "player_match_stats" (
	"revision_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"tournament_id" uuid NOT NULL,
	"tournament_player_id" uuid NOT NULL,
	"stat_definition_id" uuid NOT NULL,
	"value" numeric(16, 4) NOT NULL,
	CONSTRAINT "player_match_stats_pk" PRIMARY KEY("revision_id","tournament_player_id","stat_definition_id"),
	CONSTRAINT "player_match_stats_value_nonnegative" CHECK ("player_match_stats"."value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stat_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sport" varchar(40) NOT NULL,
	"key" varchar(80) NOT NULL,
	"name" varchar(100) NOT NULL,
	"unit" varchar(30) DEFAULT 'count' NOT NULL,
	CONSTRAINT "stat_definitions_sport_key_unique" UNIQUE("sport","key")
);
--> statement-breakpoint
CREATE TABLE "fantasy_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fantasy_league_id" uuid NOT NULL,
	"tournament_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"invitation_id" uuid,
	"name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fantasy_entries_user_unique" UNIQUE("fantasy_league_id","user_id"),
	CONSTRAINT "fantasy_entries_scope_unique" UNIQUE("id","fantasy_league_id","tournament_id")
);
--> statement-breakpoint
CREATE TABLE "fantasy_entry_match_points" (
	"run_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"squad_id" uuid NOT NULL,
	"fantasy_league_id" uuid NOT NULL,
	"tournament_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"points" numeric(16, 4) NOT NULL,
	CONSTRAINT "fantasy_entry_match_points_pk" PRIMARY KEY("run_id","entry_id")
);
--> statement-breakpoint
CREATE TABLE "fantasy_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fantasy_league_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"email" varchar(255),
	"created_by" uuid NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fantasy_invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "fantasy_invitations_scope_unique" UNIQUE("id","fantasy_league_id"),
	CONSTRAINT "fantasy_invitations_max_uses_positive" CHECK ("fantasy_invitations"."max_uses" > 0),
	CONSTRAINT "fantasy_invitations_expiry" CHECK ("fantasy_invitations"."expires_at" > "fantasy_invitations"."created_at")
);
--> statement-breakpoint
CREATE TABLE "fantasy_leagues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"rule_set_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fantasy_leagues_scope_unique" UNIQUE("id","tournament_id"),
	CONSTRAINT "fantasy_leagues_policy_unique" UNIQUE("id","tournament_id","rule_set_id")
);
--> statement-breakpoint
CREATE TABLE "fantasy_rule_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"version" integer NOT NULL,
	"squad_size" integer NOT NULL,
	"starting_size" integer NOT NULL,
	"budget" numeric(12, 2) NOT NULL,
	"max_per_team" integer NOT NULL,
	"transfer_limit" integer NOT NULL,
	"captain_multiplier" numeric(6, 2) NOT NULL,
	"role_limits" jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fantasy_rule_sets_version_unique" UNIQUE("tournament_id","name","version"),
	CONSTRAINT "fantasy_rule_sets_scope_unique" UNIQUE("id","tournament_id"),
	CONSTRAINT "fantasy_rule_sets_bounds" CHECK ("fantasy_rule_sets"."version" > 0 AND "fantasy_rule_sets"."squad_size" > 0 AND "fantasy_rule_sets"."starting_size" > 0 AND "fantasy_rule_sets"."starting_size" <= "fantasy_rule_sets"."squad_size" AND "fantasy_rule_sets"."budget" >= 0 AND "fantasy_rule_sets"."max_per_team" > 0 AND "fantasy_rule_sets"."max_per_team" <= "fantasy_rule_sets"."squad_size" AND "fantasy_rule_sets"."transfer_limit" >= 0 AND "fantasy_rule_sets"."captain_multiplier" >= 1),
	CONSTRAINT "fantasy_rule_sets_roles_object" CHECK (jsonb_typeof("fantasy_rule_sets"."role_limits") = 'object')
);
--> statement-breakpoint
CREATE TABLE "fantasy_scoring_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_set_id" uuid NOT NULL,
	"stat_definition_id" uuid NOT NULL,
	"points_per_unit" numeric(12, 4) NOT NULL,
	"minimum" numeric(16, 4),
	"maximum" numeric(16, 4),
	CONSTRAINT "fantasy_scoring_rules_range" CHECK ("fantasy_scoring_rules"."minimum" IS NULL OR "fantasy_scoring_rules"."maximum" IS NULL OR "fantasy_scoring_rules"."maximum" >= "fantasy_scoring_rules"."minimum")
);
--> statement-breakpoint
CREATE TABLE "fantasy_squad_picks" (
	"squad_id" uuid NOT NULL,
	"tournament_id" uuid NOT NULL,
	"tournament_player_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"purchase_price" numeric(12, 2) NOT NULL,
	"is_starting" boolean NOT NULL,
	"is_captain" boolean DEFAULT false NOT NULL,
	"is_vice_captain" boolean DEFAULT false NOT NULL,
	CONSTRAINT "fantasy_squad_picks_pk" PRIMARY KEY("squad_id","tournament_player_id"),
	CONSTRAINT "fantasy_squad_picks_slot_unique" UNIQUE("squad_id","slot"),
	CONSTRAINT "fantasy_squad_picks_valid" CHECK ("fantasy_squad_picks"."slot" > 0 AND "fantasy_squad_picks"."purchase_price" >= 0 AND NOT ("fantasy_squad_picks"."is_captain" AND "fantasy_squad_picks"."is_vice_captain") AND (NOT ("fantasy_squad_picks"."is_captain" OR "fantasy_squad_picks"."is_vice_captain") OR "fantasy_squad_picks"."is_starting"))
);
--> statement-breakpoint
CREATE TABLE "fantasy_squads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"fantasy_league_id" uuid NOT NULL,
	"tournament_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"status" "squad_status" DEFAULT 'draft' NOT NULL,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fantasy_squads_entry_round_unique" UNIQUE("entry_id","round_id"),
	CONSTRAINT "fantasy_squads_scope_unique" UNIQUE("id","tournament_id"),
	CONSTRAINT "fantasy_squads_result_scope_unique" UNIQUE("id","entry_id","fantasy_league_id","tournament_id","round_id"),
	CONSTRAINT "fantasy_squads_lock_time" CHECK (("fantasy_squads"."status" = 'locked') = ("fantasy_squads"."locked_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "fantasy_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"fantasy_league_id" uuid NOT NULL,
	"tournament_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"outgoing_player_id" uuid NOT NULL,
	"incoming_player_id" uuid NOT NULL,
	"sale_price" numeric(12, 2) NOT NULL,
	"purchase_price" numeric(12, 2) NOT NULL,
	"request_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fantasy_transfers_request_unique" UNIQUE("entry_id","request_id"),
	CONSTRAINT "fantasy_transfers_valid" CHECK ("fantasy_transfers"."outgoing_player_id" <> "fantasy_transfers"."incoming_player_id" AND "fantasy_transfers"."sale_price" >= 0 AND "fantasy_transfers"."purchase_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "player_match_points" (
	"run_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"tournament_id" uuid NOT NULL,
	"tournament_player_id" uuid NOT NULL,
	"points" numeric(16, 4) NOT NULL,
	"breakdown" jsonb NOT NULL,
	CONSTRAINT "player_match_points_pk" PRIMARY KEY("run_id","tournament_player_id")
);
--> statement-breakpoint
CREATE TABLE "scoring_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fantasy_league_id" uuid NOT NULL,
	"tournament_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"rule_set_id" uuid NOT NULL,
	"engine_version" varchar(50) NOT NULL,
	"status" "scoring_run_status" DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scoring_runs_calculation_unique" UNIQUE("fantasy_league_id","match_id","revision_id","rule_set_id","engine_version"),
	CONSTRAINT "scoring_runs_match_scope_unique" UNIQUE("id","match_id","tournament_id"),
	CONSTRAINT "scoring_runs_entry_scope_unique" UNIQUE("id","fantasy_league_id","tournament_id","round_id"),
	CONSTRAINT "scoring_runs_completion_time" CHECK (("scoring_runs"."status" = 'completed') = ("scoring_runs"."completed_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_match_number_unique";--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "tournament_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "round_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_scope_unique" UNIQUE("id","tournament_id");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_round_scope_unique" UNIQUE("id","tournament_id","round_id");--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_players" ADD CONSTRAINT "tournament_players_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_players" ADD CONSTRAINT "tournament_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_players" ADD CONSTRAINT "tournament_players_scope_1_fk" FOREIGN KEY ("tournament_id","team_id") REFERENCES "public"."tournament_teams"("tournament_id","team_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_rounds" ADD CONSTRAINT "tournament_rounds_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cricket_innings" ADD CONSTRAINT "cricket_innings_scope_1_fk" FOREIGN KEY ("revision_id","match_id","tournament_id") REFERENCES "public"."match_stat_revisions"("id","match_id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cricket_innings" ADD CONSTRAINT "cricket_innings_scope_2_fk" FOREIGN KEY ("tournament_id","batting_team_id") REFERENCES "public"."tournament_teams"("tournament_id","team_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cricket_innings" ADD CONSTRAINT "cricket_innings_scope_3_fk" FOREIGN KEY ("tournament_id","bowling_team_id") REFERENCES "public"."tournament_teams"("tournament_id","team_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_scope_1_fk" FOREIGN KEY ("match_id","tournament_id") REFERENCES "public"."matches"("id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_scope_2_fk" FOREIGN KEY ("tournament_player_id","tournament_id") REFERENCES "public"."tournament_players"("id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_scope_1_fk" FOREIGN KEY ("revision_id","match_id","tournament_id") REFERENCES "public"."match_stat_revisions"("id","match_id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_scope_2_fk" FOREIGN KEY ("tournament_id","winner_team_id") REFERENCES "public"."tournament_teams"("tournament_id","team_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_stat_revisions" ADD CONSTRAINT "match_stat_revisions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_stat_revisions" ADD CONSTRAINT "match_stat_revisions_scope_1_fk" FOREIGN KEY ("match_id","tournament_id") REFERENCES "public"."matches"("id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_stat_definition_id_stat_definitions_id_fk" FOREIGN KEY ("stat_definition_id") REFERENCES "public"."stat_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_scope_1_fk" FOREIGN KEY ("revision_id","match_id","tournament_id") REFERENCES "public"."match_stat_revisions"("id","match_id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_scope_2_fk" FOREIGN KEY ("match_id","tournament_player_id","tournament_id") REFERENCES "public"."match_players"("match_id","tournament_player_id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_entries" ADD CONSTRAINT "fantasy_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_entries" ADD CONSTRAINT "fantasy_entries_scope_1_fk" FOREIGN KEY ("fantasy_league_id","tournament_id") REFERENCES "public"."fantasy_leagues"("id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_entries" ADD CONSTRAINT "fantasy_entries_scope_2_fk" FOREIGN KEY ("invitation_id","fantasy_league_id") REFERENCES "public"."fantasy_invitations"("id","fantasy_league_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_entry_match_points" ADD CONSTRAINT "fantasy_entry_match_points_scope_1_fk" FOREIGN KEY ("run_id","fantasy_league_id","tournament_id","round_id") REFERENCES "public"."scoring_runs"("id","fantasy_league_id","tournament_id","round_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_entry_match_points" ADD CONSTRAINT "fantasy_entry_match_points_scope_2_fk" FOREIGN KEY ("squad_id","entry_id","fantasy_league_id","tournament_id","round_id") REFERENCES "public"."fantasy_squads"("id","entry_id","fantasy_league_id","tournament_id","round_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_invitations" ADD CONSTRAINT "fantasy_invitations_fantasy_league_id_fantasy_leagues_id_fk" FOREIGN KEY ("fantasy_league_id") REFERENCES "public"."fantasy_leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_invitations" ADD CONSTRAINT "fantasy_invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_leagues" ADD CONSTRAINT "fantasy_leagues_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_leagues" ADD CONSTRAINT "fantasy_leagues_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_leagues" ADD CONSTRAINT "fantasy_leagues_scope_1_fk" FOREIGN KEY ("rule_set_id","tournament_id") REFERENCES "public"."fantasy_rule_sets"("id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_rule_sets" ADD CONSTRAINT "fantasy_rule_sets_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_scoring_rules" ADD CONSTRAINT "fantasy_scoring_rules_rule_set_id_fantasy_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."fantasy_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_scoring_rules" ADD CONSTRAINT "fantasy_scoring_rules_stat_definition_id_stat_definitions_id_fk" FOREIGN KEY ("stat_definition_id") REFERENCES "public"."stat_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_squad_picks" ADD CONSTRAINT "fantasy_squad_picks_scope_1_fk" FOREIGN KEY ("squad_id","tournament_id") REFERENCES "public"."fantasy_squads"("id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_squad_picks" ADD CONSTRAINT "fantasy_squad_picks_scope_2_fk" FOREIGN KEY ("tournament_player_id","tournament_id") REFERENCES "public"."tournament_players"("id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_squads" ADD CONSTRAINT "fantasy_squads_scope_1_fk" FOREIGN KEY ("entry_id","fantasy_league_id","tournament_id") REFERENCES "public"."fantasy_entries"("id","fantasy_league_id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_squads" ADD CONSTRAINT "fantasy_squads_scope_2_fk" FOREIGN KEY ("round_id","tournament_id") REFERENCES "public"."tournament_rounds"("id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_transfers" ADD CONSTRAINT "fantasy_transfers_scope_1_fk" FOREIGN KEY ("entry_id","fantasy_league_id","tournament_id") REFERENCES "public"."fantasy_entries"("id","fantasy_league_id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_transfers" ADD CONSTRAINT "fantasy_transfers_scope_2_fk" FOREIGN KEY ("round_id","tournament_id") REFERENCES "public"."tournament_rounds"("id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_transfers" ADD CONSTRAINT "fantasy_transfers_scope_3_fk" FOREIGN KEY ("outgoing_player_id","tournament_id") REFERENCES "public"."tournament_players"("id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_transfers" ADD CONSTRAINT "fantasy_transfers_scope_4_fk" FOREIGN KEY ("incoming_player_id","tournament_id") REFERENCES "public"."tournament_players"("id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_match_points" ADD CONSTRAINT "player_match_points_scope_1_fk" FOREIGN KEY ("run_id","match_id","tournament_id") REFERENCES "public"."scoring_runs"("id","match_id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_match_points" ADD CONSTRAINT "player_match_points_scope_2_fk" FOREIGN KEY ("match_id","tournament_player_id","tournament_id") REFERENCES "public"."match_players"("match_id","tournament_player_id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_runs" ADD CONSTRAINT "scoring_runs_scope_1_fk" FOREIGN KEY ("fantasy_league_id","tournament_id","rule_set_id") REFERENCES "public"."fantasy_leagues"("id","tournament_id","rule_set_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_runs" ADD CONSTRAINT "scoring_runs_scope_2_fk" FOREIGN KEY ("match_id","tournament_id","round_id") REFERENCES "public"."matches"("id","tournament_id","round_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_runs" ADD CONSTRAINT "scoring_runs_scope_3_fk" FOREIGN KEY ("revision_id","match_id","tournament_id") REFERENCES "public"."match_stat_revisions"("id","match_id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "league_members_user_idx" ON "league_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "leagues_owner_idx" ON "leagues" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "tournament_players_team_idx" ON "tournament_players" USING btree ("tournament_id","team_id");--> statement-breakpoint
CREATE INDEX "tournament_players_player_idx" ON "tournament_players" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "tournament_rounds_deadline_idx" ON "tournament_rounds" USING btree ("tournament_id","deadline");--> statement-breakpoint
CREATE INDEX "tournament_teams_team_idx" ON "tournament_teams" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "match_players_registration_idx" ON "match_players" USING btree ("tournament_player_id","tournament_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_stat_revisions_one_published" ON "match_stat_revisions" USING btree ("match_id") WHERE "match_stat_revisions"."status" = 'published';--> statement-breakpoint
CREATE INDEX "player_match_stats_player_idx" ON "player_match_stats" USING btree ("tournament_player_id","stat_definition_id");--> statement-breakpoint
CREATE INDEX "fantasy_entries_user_idx" ON "fantasy_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fantasy_entries_invitation_idx" ON "fantasy_entries" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "fantasy_entry_match_points_entry_idx" ON "fantasy_entry_match_points" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "fantasy_invitations_league_idx" ON "fantasy_invitations" USING btree ("fantasy_league_id");--> statement-breakpoint
CREATE INDEX "fantasy_leagues_tournament_idx" ON "fantasy_leagues" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "fantasy_leagues_owner_idx" ON "fantasy_leagues" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "fantasy_scoring_rules_ruleset_idx" ON "fantasy_scoring_rules" USING btree ("rule_set_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fantasy_squad_picks_one_captain" ON "fantasy_squad_picks" USING btree ("squad_id") WHERE "fantasy_squad_picks"."is_captain";--> statement-breakpoint
CREATE UNIQUE INDEX "fantasy_squad_picks_one_vice_captain" ON "fantasy_squad_picks" USING btree ("squad_id") WHERE "fantasy_squad_picks"."is_vice_captain";--> statement-breakpoint
CREATE INDEX "fantasy_squad_picks_player_idx" ON "fantasy_squad_picks" USING btree ("tournament_player_id","tournament_id");--> statement-breakpoint
CREATE INDEX "fantasy_squads_round_idx" ON "fantasy_squads" USING btree ("round_id","tournament_id");--> statement-breakpoint
CREATE INDEX "fantasy_transfers_usage_idx" ON "fantasy_transfers" USING btree ("entry_id","created_at");--> statement-breakpoint
CREATE INDEX "scoring_runs_leaderboard_idx" ON "scoring_runs" USING btree ("fantasy_league_id","status","match_id");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_scope_1_fk" FOREIGN KEY ("round_id","tournament_id") REFERENCES "public"."tournament_rounds"("id","tournament_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_scope_2_fk" FOREIGN KEY ("tournament_id","team1_id") REFERENCES "public"."tournament_teams"("tournament_id","team_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_scope_3_fk" FOREIGN KEY ("tournament_id","team2_id") REFERENCES "public"."tournament_teams"("tournament_id","team_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "matches_legacy_number_unique" ON "matches" USING btree ("match_number") WHERE "matches"."tournament_id" IS NULL;--> statement-breakpoint
CREATE INDEX "matches_tournament_schedule_idx" ON "matches" USING btree ("tournament_id","date");--> statement-breakpoint
CREATE INDEX "matches_round_idx" ON "matches" USING btree ("round_id","tournament_id");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_number_unique" UNIQUE("tournament_id","match_number");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_distinct_teams" CHECK ("matches"."team1_id" <> "matches"."team2_id");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_round_scope" CHECK (("matches"."tournament_id" IS NULL) = ("matches"."round_id" IS NULL));