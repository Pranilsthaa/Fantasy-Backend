# Project memory

Updated: 2026-11-16 (Asia/Kathmandu).

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
