# Project memory

Updated: 2026-11-18 (Asia/Kathmandu).

## Product requirements confirmed by the user

A local-league fantasy platform inspired by FPL. Organizers create leagues and
run tournaments, register real teams and players, publish schedules, invite
fantasy managers, and enter match statistics. Those statistics power fantasy
points and tournament analytics. Cricket is the first sport; keep extensions to
other sports possible. Squads persist across rounds. Managers receive a limited
number of transfers for the **whole tournament**, not a fresh allowance per round.
No particular squad size, budget, transfer allowance or scoring formula has been
confirmed; these must be configurable, not copied from FPL or IPL.

## Completed baseline

The Express app was converted to NestJS in commit `cc03d73`. Bun, Drizzle and
PostgreSQL remain. Root, player and match routes preserve their existing public
contracts. Nest owns the application pool lifecycle. Eight HTTP regression tests,
TypeScript checking, build, and compiled startup passed during that migration.
The HTTP tests mock the database; they are not evidence of SQL correctness.

## Current work and checkpoints

1. Requirements and baseline inspection: complete. Applied local
   `nestjs-architecture-principles` and `nestjs-features-performance` skills,
   plus newly installed Neon / neon-postgres guidance. Preserve the user's
   untracked `.agents/`, `skills-lock.json` and deleted Cursor rule.
2. Database design: complete; see `docs/database-design.md` (entity table,
   Mermaid relationship diagram, ownership, SQL vs application invariants).
3. Drizzle schema: complete, **28 tables** (including auth sessions). New files: `src/db/tournaments.ts`,
   `statistics.ts`, `fantasy.ts`; legacy schemas remain compatible. Reviewed
   migrations `0004_curved_hulk.sql`, `0005_parched_hannibal_king.sql` and
   auth migration `0006_lively_dorian_gray.sql` applied.
4. Neon configuration and environment wiring: complete (details below).
5. Verification: complete. **41 auth/API tests + 15 real PostgreSQL tests pass**;
   `npm run build`, `bun run typecheck`, schema drift check, compiled runtime
   smoke check and `git diff --check` pass. See `docs/verification.md` for output.
6. JWT authentication: implemented and verified; see checkpoint below.
7. League/fantasy feature workflows: next checkpoint.

## Neon setup progress

- Account and deployment identifiers are intentionally omitted. Resolve the
  current target through private local Neon configuration.
- Requested service: PostgreSQL only. Database service configuration is deployed;
  this does not host the Nest HTTP server.
- Global Neon CLI installed. Requested `neon init` completed; browser login
  succeeded. `neon deploy` reported the existing Postgres service matches policy
  and pulled five variables into ignored `.env.local`.
- Runtime uses pooled `DATABASE_URL`; migrations use direct
  `DATABASE_URL_UNPOOLED`. Explicit process variables override local dotenv files.
  Neon TLS is explicitly `verify-full`. Shared application pool: max 5,
  connect timeout 15s, idle timeout 30s, query/statement deadlines and idle error
  handling; Nest closes its pool on shutdown.
- Read-only production preflight found an empty database. Full migration chain
  rehearsed on an isolated, expiring test branch, including legacy rows,
  before applying to production. Production local credentials were never switched.
- Test fixtures cleaned up. Private temporary verification credentials removed.
  Production smoke wrote no data; player/match lists correctly returned empty.
- `GET /health/database` executes a real SQL query and returns generic 200/503.
- `npm run verify:runtime` tests the compiled server and actual database. Live
  integration tests require explicit `TEST_DATABASE_URL` and a
  `TEST_NEON_BRANCH` beginning `schema-check-`; never use production as fallback.
- Keep this memory free of credentials, connection-string values, account IDs,
  project IDs, endpoint hostnames and deployment-specific branch identifiers.
  Environment variable names and configuration filenames are safe to document.

## Architecture decisions

Keep a modular monolith. Tournament management owns real competition data;
statistics owns published revisions; fantasy owns entries/squads/transfers;
scoring owns reproducible derived points. Authentication/authorization belongs
in application guards/services, with database keys/checks protecting integrity.
A user can both organize and play; organizer/scorer permissions are scoped to a
league, independently of the existing global user role.

Use round snapshots and immutable published statistics/rule versions so that a
correction can be recomputed without double counting or changing historic squad
selection. Point totals/ranks are derived data, not independent sources of truth.
Keep legacy endpoints and rows working during the schema expansion.

## Decisions still needed before feature APIs

Exact scoring, squad/starting lineup size, budget, per-team/role limits, number
of tournament-wide transfers, captain/vice captain behavior, postponement rules,
late joining and invitation delivery. The schema should support configuration;
those application workflows and the points engine are outside this schema-first
checkpoint and must not be represented as implemented.

## Known boundaries and upgrade notes

Scoring rows and exact-decimal joins are verified, but no automated points engine
or fantasy feature APIs have been built. Deadline, budget, roster/role counts,
tournament transfer cap, immutable published history and scorer permissions need
the application transactions described in the design. Database constraints alone
do not enforce those aggregate policies. Existing list endpoints are still global
compatibility reads; tenant-scoped authenticated reads are required for launch.
Existing globally unique team codes/names and cricket roles remain a legacy
compatibility boundary for a later identity/API migration. Original migration 0003
needs a data mapping for databases containing long-name roles; this target was
empty, and the upgrade rehearsal's legacy rows used the current BAT/BWL roles.
No remaining verification failures. No seed data was added to production.

## JWT authentication checkpoint

Implemented on 2026-11-16 over the existing users table. No second identity
provider or Neon Auth service was enabled. See `docs/authentication.md`.

- Routes: `POST /api/auth/register`, `/login`, `/refresh`, `/logout`;
  `GET /api/auth/me` (all under `/api/auth`).
- Argon2id passwords; normalized email/username; case-insensitive unique indexes;
  signup always creates the regular user role. Strict DTO validation rejects
  unexpected fields and role injection. Password hashes never appear in profiles.
- Fifteen-minute HS256 access JWTs with fixed issuer/audience, access purpose,
  user/session IDs and unique token ID. Signature, timing and claims are verified.
- Seven-day absolute sessions. Only refresh-token hashes are persisted. Refresh
  rotation is atomic, rejects reuse/concurrent losers and does not extend expiry.
  Logout revokes the current session immediately, including its access JWTs.
- Global guard defaults new routes to authenticated. Existing root, health,
  player list and match list routes are explicitly public. Future league writes
  still require ownership/membership authorization in application services.
- Auth endpoints have per-IP/route throttling and no-store responses. Rate-limit
  storage is local to one instance; shared storage is needed for multiple replicas.
- `JWT_SECRET` is required and validated at startup. `bun run auth:setup` creates
  a strong local value only when missing, without printing or replacing it.
  Keep the value exclusively in ignored environment files/deployment secrets.
- Migration `0006_lively_dorian_gray.sql` adds sessions and identity indexes.
  It was rehearsed on the isolated test branch and applied to the application
  database. The live preflight found zero duplicate email/username groups.
- Verification: **41 auth/API tests + 15 real PostgreSQL integration tests pass**.
  Live auth tests use an isolated branch and remove their accounts/sessions.
  Build and TypeScript checks pass. Production runtime verification is recorded
  in `docs/verification.md`. No secrets or deployment identifiers belong here.
- The TypeScript config was aligned with the declared TypeScript 5 dependency by
  removing a TypeScript-6-only deprecation setting.
- Not implemented: email verification, password recovery/change, MFA, social
  login, token-family replay revocation and all-device logout. Clients must
  serialize refresh/logout and retain the latest refresh credential. Matching
  an email alone must not authorize invitation claims before verification exists.

## Swagger documentation checkpoint

- Swagger UI: `/api/docs`; OpenAPI JSON: `/api/docs-json`.
- NestJS 11-compatible Swagger package. Setup is in
  `src/documentation/swagger.ts`, called by `src/main.ts`.
- Documented all nine existing API operations with tags, request/response models,
  validation constraints, status codes, rate limits and JWT bearer authorization.
- Explicit property/body/response metadata supports Bun source mode and the
  compiled app. No real credentials or internal persistence fields are in schemas.
- UI/spec are public; protected API operations retain the JWT guard. Users enter
  an access token through Authorize; authorization is not persisted on reload.
- Documentation tests verify UI/assets, schemas, all operation paths, bearer
  requirements and private-field exclusion. Schema additions need no DB migration.
- See README for access instructions and `docs/verification.md` for final checks.
- Verification: 46 Swagger/auth/API tests pass, along with build, typecheck and
  compiled runtime documentation checks. No live data was written.
- Compatible Express dependency patch constraints clear the install audit's high
  and critical findings. Four moderate Drizzle development-tooling findings remain;
  a suggested major-version change was left for separate review.

## Post-login checkpoint 1 — completed 2026-11-17

User confirmed: any signed-in user can create a cricket league; only the owner
assigns/removes existing registered users as admins/scorers; admins manage draft
tournament editions; scorers read setup. League editing is owner-only. No global
administrator bypass. Participant invitations and fantasy membership are later.

- One `LeaguesModule`, controller, service and DTOs under `src/module/leagues`.
  Direct Drizzle queries over existing tables; no new dependencies or schema.
- Eleven JWT-protected endpoints under `/api/leagues`: create/list/details/edit,
  staff list/assignment/removal, tournament create/list/details/edit.
- My Leagues includes owned leagues and active staff memberships. Twenty-row
  pagination, stable ordering, generated stable slugs, cricket fixed on creation.
- Draft tournaments default to Asia/Kathmandu, validate timezone and timestamp
  ordering, and enforce unique seasons within a league. Partial date edits use
  the latest locked row. No status transitions or deletion API in this checkpoint.
- Cross-league resources are hidden with 404; insufficient staff roles get 403.
  Owner/status/sport injection is rejected. Membership removal is soft and prevents
  subsequent access; reassignment can reactivate/change the role.
- Swagger includes request/response DTOs and explicit UUID parameters for Bun.
  See `docs/leagues.md` for endpoint details and permission matrix.
- Tests: 47 API/auth/documentation regressions pass; the live PostgreSQL suite has
  16 passing tests, including the full league permission flow with 50 additional
  assertions. Test data was isolated and cleaned up. Build/typecheck pass.
- Current user change retained: registration password minimum is eight characters;
  the stale Swagger test expectation was aligned to the current validated DTO.
- Next: checkpoint 2, tournament team/player registration. Decisions for that
  checkpoint should use the requested grilling skill before implementation.
  Keep the scope small; do not add participant invites/scoring prematurely.
- Never store credentials, connection strings, account/project/branch identifiers
  or signing secrets in this memory.

## Revised delivery order and roster decisions

Build the real tournament workflow first: league-scoped teams and players,
fixtures and schedules, match statistics and results, then tournament reports.
Fantasy features follow once that data is available.

A league reuses player profiles across tournament editions. Each edition assigns
one team per player and may assign a different team in a later season. Preserve
the registration's team and role once the player has recorded match history.
Owners/admins manage the roster and scorers can read it. Start with manual
catalogue management and enrollment. Defer fantasy pricing, bulk imports, and
player accounts. Logo and age are optional.

“Game type” means sport. The user confirmed cricket for the first release.
Design cricket statistics and score entry in their own checkpoint.


## Post-login checkpoint 2 — league teams and player registration

Implemented manual team/player catalogue management and draft tournament
enrollment. Teams and profiles belong to one league. A profile can represent
different teams across editions, with one registration per tournament. Once
a match participant references a registration, edits and removal are blocked.
Owners/admins write and scorers read. Unused registrations can be removed.
Fantasy prices remain optional until the fantasy workflow.

Migration `0007_league_catalogue.sql` was verified on disposable local PostgreSQL,
including an upgrade with existing records. It has not been applied to the hosted
database. The private catalogue and tournament records stay out of legacy public
lists. Swagger documents the team and roster endpoints. All 64 tests, typecheck,
and build passed. Next checkpoint is fixtures and schedules.

## Post-login checkpoint 3 — fixtures and schedules

User confirmed manual scheduling and public visibility after publication.
Owners/admins create, reschedule, and publish fixtures. Scorers can read draft
schedules. Teams must both be enrolled and distinct. Fixture numbers are unique
within the tournament. A fixture can be created without a fantasy round.

Publishing records a timestamp without changing tournament status. The public
endpoint `/api/tournaments/:tournamentId/schedule` returns 404 until publication
and lists fixtures in chronological order afterward. Staff can still reschedule
upcoming fixtures. Delete is limited to upcoming fixtures on unpublished schedules.
Published fixtures can go live or be cancelled. Completion comes with results.
Fixture edits are blocked after play starts or participants have been recorded.

Migration `0008_tournament_schedules.sql` was verified on disposable local
PostgreSQL and has not been applied to the hosted database. All 64 tests
(365 assertions), build, typecheck, and Swagger path/schema checks passed.
Next checkpoint is cricket scorecards, statistics, and results.

## Cricket match management scope

The user wants a match-management app as well as fantasy. For cricket, staff
must be able to see the active batters, select the active bowler, and record
play delivery by delivery. Preserve delivery data so scorecards, tournament
statistics, and later fantasy scoring can use the same match history. Owners
and league admins publish official scorecards and results, including corrections
with revision history. Tournament reports precede the fantasy workflows.

The first supported cricket formats and visibility of live scoring are open
product decisions. Existing innings and player statistics tables store scorecard
summaries. Delivery history and active lineup state need additional support.

## Post-login checkpoint 4 — cricket scoring

User confirmed limited overs first and a public live score for published fixtures.
The backend now supports one innings per side, 1–50 overs, lineup selection,
active batter selection, over-by-over bowler selection, and delivery recording.
Scorecards derive team totals and batting, bowling and fielding metrics from
the delivery stream. The record is ready for tournament reports. Clients poll
the public scorecard endpoint to follow play. Owner/admin publication creates
an official revision and stores the innings, result and player observations.
A correction keeps the previous official score live until the new revision is
published. Scorers can enter and undo deliveries and only owners/admins publish.

Migration `0009_cricket_scoring.sql` and the end-to-end workflow passed on local
PostgreSQL. Build, typecheck and all 67 tests passed. Migration 0009 is pending
on the hosted database. See `docs/cricket-scoring.md` for supported rules,
delivery inputs and current scoring limits. Next checkpoint is tournament
reports and player/team statistics, then fantasy.

## Post-login checkpoint 5 — tournament reports

User confirmed public results, team standings, and player leaderboards for
published tournaments. Cricket standings use net run rate after points.
Football is a future sport and the user indicated it should use shared ranks
for equal points. This checkpoint delivers cricket reports only.

Public paged reports sit under `/api/tournaments/:tournamentId/reports`.
Results, team records and player statistics read the current official
scorecard revision. The cricket table gives 2 points for wins, 1 for ties or
no result, and 0 for losses. NRR uses aggregate runs and legal-ball counts,
the allocated quota for all-out innings, and excludes no-result matches.
Identical points and NRR share a rank. Existing results without overs data
retain points and are excluded from NRR.

The PostgreSQL test covers public access, hidden drafts, NRR and all-out
handling, equal points, no-results, leaderboard ordering, paging and correction
publication. All 67 tests (441 assertions), build and typecheck passed. No
migration was required for reports. The fantasy phase follows.

## Fantasy entry and group decisions

The user confirmed a single squad and season-wide transfer allowance per user
per tournament. A player can join multiple private fantasy groups and each
group ranks its own members using their shared tournament entry. Once organizers
make fantasy available, any signed-in user may create a private group and invite
friends through a shareable link. Tournament owners and admins control
availability. Group creators manage invitations.

The initial schema scopes entries, squads, transfers and scoring runs by group.
The fantasy implementation needs to scope them by tournament and link groups
through memberships that reference the shared entry. A league invitation grants
membership in one group. It does not create a second squad or transfer allowance.
The initial fantasy rule configuration and late-entry behavior are pending.
