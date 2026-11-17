# Fantasy API

NestJS API using Bun, Drizzle ORM and PostgreSQL. The existing database schema,
SQL migrations and public response formats are preserved.

## Setup

```bash
bun install
cp .env.example .env
```

Set `DATABASE_URL` in `.env` to your PostgreSQL connection string. The server
requires it at startup. `PORT` defaults to `3001`; `NODE_ENV=development` enables
request logging. Existing databases do not need a new migration for this conversion.

```bash
bun run db:migrate    # Apply existing migrations when setting up a database
bun run auth:setup   # Generate a private local JWT signing secret once
bun run start:dev    # Watch TypeScript sources
```

## Build and verification

```bash
bun run typecheck
bun test
bun run build
bun run start:prod   # Run dist/main.js after building
```

`bun start` builds and starts the application. TypeScript emits Nest decorator
metadata for production; explicit injection tokens also support Bun's source runner.
The HTTP regression tests start Nest on an ephemeral localhost port, replacing
only the database provider. They do not connect to or modify PostgreSQL.

## Routes

- `GET /` → `Fantasy API is running`
- `GET /api/players` → `{ success: true, message: "Players fetched successfully", data: [...] }`
- `GET /api/matches` → `{ success: true, message: "Matches fetched successfully", data: [...] }`

Both list routes retain their selected columns and joined team fields. Query
failures return status `500` with `{ success: false, message: "Internal server error" }`.

## Structure

- `src/main.ts`: Nest bootstrap and shutdown hooks.
- `src/app.module.ts`: application composition and development request middleware.
- `src/module/players`, `src/module/matches`: feature modules, controllers and query services.
- `src/database`: injectable Drizzle connection with pool cleanup on shutdown.
- `src/db/schema.ts`: shared schema exports without connection side effects.
- `src/db/index.ts`: standalone database connection for the existing seed script.
- `drizzle/`: unchanged SQL migrations.

Database commands remain available: `bun run db:generateMigration`,
`bun run db:migrate`, and `bun run db:seed`. Seeding writes sample data and should
only be run against an appropriate development database.

## Local league product and schema

See [MEMORY.md](MEMORY.md) for confirmed requirements and checkpoint progress,
and [database design](docs/database-design.md) for the entity map, ownership,
invariants, transaction boundaries and remaining product decisions. The first
sport is cricket. Fantasy squads persist and have a tournament-wide transfer
allowance. Squad/budget/role/transfer/scoring settings are explicit per rule-set
version; no assumed FPL values are baked in.

The schema, persistence checks and JWT authentication are implemented. League creation, invitations,
stat entry, squad transfers and the scoring engine are future authenticated
feature APIs; the schema is not a complete playable app yet.

## Neon PostgreSQL

`neon.ts` declares PostgreSQL-only infrastructure for the project linked in the
ignored `.neon` file. `neon deploy` reconciles service configuration and pulls
`DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct) into `.env.local`, or
`.env` if one already exists. It does not host this Nest server or run SQL migrations.
The app and Drizzle config load `.env.local` then `.env`; existing process variables
win. Keep both files private. `pg` reuses a bounded five-connection application
pool, verifies Neon TLS certificates and allows time for suspended compute to wake.

```bash
neon deploy
bun run db:migrate     # Uses the direct connection; run once per deployment
npm run build
bun run start:prod
```

For a read-only compiled-server and database check: `npm run verify:runtime`.

`GET /health/database` performs a real PostgreSQL query. It returns
`{ "status": "ok", "database": "connected" }` or HTTP 503 with a generic failure.
It does not expose database configuration or errors.

Rehearse migrations on an isolated branch before production. The integration
suite first installs the pre-expansion schema, inserts legacy rows, applies the
new migrations, then checks real HTTP reads, SQL constraints, decimal prices,
cricket innings, tournament-wide transfer counting and score provenance.
Fixtures are rolled back/deleted after testing. It never defaults to the app's
production URL. Supply the test branch credentials privately:

```bash
# Set TEST_DATABASE_URL to the isolated branch's direct connection string.
# Set TEST_NEON_BRANCH to its schema-check-<name> branch name.
bun run test:integration
```

Running `bun test` without those variables runs the ordinary HTTP regression
suite and skips PostgreSQL integration tests. `test:integration` fails if its
explicit test configuration is missing. See [verification](docs/verification.md)
for the executed checks and their output.

## Authentication

JWT authentication is available at `/api/auth/register`, `/api/auth/login`,
`/api/auth/refresh`, `/api/auth/logout` and `/api/auth/me`. Run `bun run auth:setup`
once to configure the private local signing key, then apply the auth migration
with `bun run db:migrate`. Local configuration has already been initialized.

Access JWTs expire after 15 minutes. Refresh credentials rotate, and each session
has an absolute seven-day lifetime. Logout revokes the session immediately.
New mapped endpoints require authentication by default; the existing schedule,
player, root and health endpoints remain explicitly public.

See [authentication](docs/authentication.md) for payloads, client behavior,
validation, token/session policy, rate limits, permissions and test coverage.

## API documentation (Swagger)

Start the server with `bun run start:dev` or `bun start`, then open:

- Swagger UI: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
- OpenAPI JSON: [http://localhost:3001/api/docs-json](http://localhost:3001/api/docs-json)

Use your configured `PORT` if different. The documentation includes every existing
endpoint, request/response schemas, validation rules, status codes and rate limits.
It works in both Bun source mode and the compiled app. No extra service or database
migration is required.

To try authenticated requests, register or log in under **Authentication**, copy
`accessToken`, click **Authorize**, and paste it without the `Bearer` prefix.
Refresh/logout use the latest `refreshToken` in their request body. Swagger does
not persist authorization across reloads. Its UI and JSON specification are public;
API authentication remains enforced independently. **Try it out** sends real
requests to the running server, including account creation and session changes.

## League management — checkpoint 1

Authenticated league and draft tournament APIs are available under `/api/leagues`.
Any user may create a league. Owners manage league details and staff; league admins
manage draft tournament editions; scorers can read setup. Lists use 20-row pages.
See [league APIs](docs/leagues.md) or the **Leagues and tournaments** Swagger tag.
Teams/player registration is the next checkpoint. No additional migration needed.
