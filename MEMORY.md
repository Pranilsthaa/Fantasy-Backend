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
3. Drizzle schema: complete, **27 tables**. New files: `src/db/tournaments.ts`,
   `statistics.ts`, `fantasy.ts`; legacy schemas remain compatible. Reviewed
   migrations `0004_curved_hulk.sql` and `0005_parched_hannibal_king.sql` applied.
4. Neon configuration and environment wiring: complete (details below).
5. Verification: complete. **10 HTTP tests + 13 real PostgreSQL tests pass**;
   `npm run build`, `bun run typecheck`, schema drift check, compiled runtime
   smoke check and `git diff --check` pass. See `docs/verification.md` for output.
6. Feature workflows: next checkpoint, not implemented in this schema task.

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
