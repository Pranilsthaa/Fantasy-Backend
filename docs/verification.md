# Database and Neon verification

Executed on 2026-11-16. No credentials are included here.

## Infrastructure

Target: organization `org-blue-mode-46098928`, project
`lively-lake-91375125`, branch `production`.

```text
$ npm i -g neon@latest
added 160 packages in 14s

$ neon init -y --org-id org-blue-mode-46098928 --project-id lively-lake-91375125 --branch production --services postgres
Linked .neon
  Project         lively-lake-91375125
  Branch          production
  Org             org-blue-mode-46098928
Config   neon.ts created

$ neon login
Auth complete (profile DEFAULT)

$ neon deploy
Applying to branch production (br-green-math-b3bqcyex)
No changes — branch production already matches the policy.
Utilized services: Postgres
Pulled 5 Neon variables into .env.local
```

Neon Postgres was already provisioned on this project. Deployment reconciled the
PostgreSQL-only configuration and pulled the existing service environment. No
Auth, storage, Functions or other paid/additional service was enabled. Neon
provided pooled and unpooled database URLs; the app and migrations use the
appropriate one. The local Nest app is not remotely hosted by this deployment.
The init command also installed Neon plugins/skills/MCP configuration for detected
local coding agents, as reported by the CLI.

## Migration safety

A read-only inspection found no public application tables on production before
migration. A child branch, `schema-check-20261116`, was created from production
with expiry **2026-11-17 06:00 UTC (11:45 Asia/Kathmandu)**. Local production
credentials were not switched to this branch. Test credentials were kept in a
private temporary file and removed after verification.

The live integration suite applies migrations 0000–0003, inserts real legacy
user/team/player/match rows, then applies 0004–0005. This verifies both clean
installation and expansion over existing rows. New domain fixtures run in a
rolled-back transaction; the committed legacy fixtures are deleted in cleanup.
The verification branch remains available for inspection until its expiry.

The reviewed migration changes are:

- `0004_curved_hulk.sql`: new tournament/fantasy/statistics tables, constraints
  and indexes; nullable tournament/round assignment on legacy matches; match
  number uniqueness scoped to tournaments with a legacy partial unique index.
- `0005_parched_hannibal_king.sql`: one current completed scoring run per
  match/fantasy league to prevent standings from counting multiple recalculations.

Existing SQL migrations were not rewritten. Their original role conversion
(0003) still requires an explicit mapping if upgrading an older external database
containing long-name cricket role values. The specified production target was
empty and did not have that issue.

```text
$ bun test test/app.e2e.test.ts
10 pass
0 fail
21 expect() calls

$ bun --env-file=<private-verification-env> run test:integration
13 pass
0 fail
18 expect() calls
```

The PostgreSQL suite verifies legacy-row preservation, real Nest HTTP reads,
fractional prices, cross-tournament foreign keys, duplicate entry and captain
rejection, one published statistics revision, valid innings wickets, transfer
usage across rounds, exact decimal score joins, one current scoring run and
round-correct score attribution. It exercises SQL data relationships; the sample
score calculation is not a completed application scoring engine.

After the rehearsal:

```text
$ npm run db:migrate
> bunx drizzle-kit migrate
Using 'pg' driver for database querying
[✓] migrations applied successfully!

$ bun run db:generateMigration
27 tables
No schema changes, nothing to migrate
```

## Required build and service check

```text
$ npm run build
> build
> tsc -p tsconfig.build.json
(exit 0)

$ bun run typecheck
$ tsc --noEmit
(exit 0)

$ npm run verify:runtime
> bun scripts/verify-runtime.ts
GET / -> 200 Fantasy API is running
GET /health/database -> 200 {"status":"ok","database":"connected"}
GET /api/players -> 200 success=true rows=0
GET /api/matches -> 200 success=true rows=0
Compiled Nest server and PostgreSQL service: PASS (no data written)
(exit 0)
```

`verify:runtime` starts **dist/main.js**, waits for startup with a bounded deadline,
checks the actual production database over HTTP, then stops the process and
allows Nest to close its pool. The legacy routes returned empty arrays because
no production test or seed records were inserted. `git diff --check` also passes.

## Issues encountered and resolved

- The initial sandboxed global CLI installation could not reach the npm registry;
  the authorized installation outside the sandbox succeeded. npm also reported
  an esbuild install-script allowlist warning; Neon config/deployment worked.
- Initialization wrote the project link offline because no CLI credentials
  existed. Browser login completed, and deployment then verified the target.
- Generated Drizzle SQL initially placed match composite unique constraints after
  dependent foreign keys. Review moved those unique constraints earlier; the
  live migration rehearsal passed before production was changed.
- A pg warning identified ambiguous `sslmode=require` behavior across major
  versions. The connection helper now explicitly uses `verify-full` for Neon.
- The new verification script initially used top-level await under the existing
  CommonJS TypeScript configuration. Wrapping it in an async function resolved
  that typecheck failure. Final build, typecheck and runtime checks pass.

No remaining verification failures were observed. This checkpoint does not
implement authentication, organizer APIs, invite acceptance, transfer enforcement
or the production scoring engine. Those workflows must enforce the documented
application transactions and tenant authorization before public use.
