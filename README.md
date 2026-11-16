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
