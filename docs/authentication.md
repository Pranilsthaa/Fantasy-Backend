# JWT authentication

The Nest API owns authentication over the existing users table. This does not
enable Neon Managed Auth or create a second account system. Runtime: Bun.

## Setup

```bash
bun install
bun run auth:setup
bun run db:migrate
npm run build
bun run start:prod
```

`auth:setup` generates a random signing secret in the ignored local environment
file only if none is configured. It does not print the value or rotate an existing
key. Set `JWT_SECRET` through the hosting platform's secret mechanism when the
server is deployed elsewhere. Startup fails if it is missing, too short or a
repeated-character placeholder. Never commit environment files or copy values
into memory, reports, logs, screenshots or client code.

Migration `0006_lively_dorian_gray.sql` creates `auth_sessions` and unique
case-insensitive email/username indexes. Existing identities must not contain
case-insensitive duplicates; reconcile any duplicates before applying it. No
existing password values are overwritten. Old seed password placeholders are
not valid login credentials. New passwords are salted Argon2id hashes, using
Bun's asynchronous worker-based implementation (64 MiB memory, 3 iterations).

## HTTP contract

| Method | Route | Input | Success | Access |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | `username`, `email`, `password` | 201, credentials + user | Public, limited |
| POST | `/api/auth/login` | `email`, `password` | 200, credentials + user | Public, limited |
| POST | `/api/auth/refresh` | `refreshToken` | 200, replacement credentials + user | Refresh credential |
| POST | `/api/auth/logout` | Latest `refreshToken` | 204, empty body | Refresh credential |
| GET | `/api/auth/me` | `Authorization: Bearer <access-jwt>` | 200, `{ user }` | Active JWT session |

Register/login/refresh return:

```json
{
  "user": {
    "id": "<user-uuid>",
    "username": "manager",
    "email": "manager@example.test",
    "role": "user",
    "createdAt": "<ISO timestamp>"
  },
  "tokenType": "Bearer",
  "accessToken": "<access-jwt>",
  "expiresIn": 900,
  "refreshToken": "<opaque-refresh-credential>",
  "refreshExpiresAt": "<ISO timestamp>"
}
```

Passwords, hashes, session internals and signing secrets are never included in
user responses. Auth responses use `Cache-Control: no-store`.

Usernames are trimmed/lowercased and must contain 3–30 ASCII letters, digits or
underscores. Emails are trimmed/lowercased and validated. Registration passwords
are 12–128 characters; they are not trimmed or case-folded. Unknown fields,
including `role` and `passwordHash`, are rejected. Registration always assigns
`user`; clients cannot grant themselves administrative or organizer permissions.
Login accepts bounded nonempty passwords so compatible historical accounts can
still authenticate. HTTP 400 indicates invalid input, 401 invalid credentials or
session, 409 duplicate account details, and 429 too many attempts. Login failures
use the same message for an unknown email and an incorrect password.

## Token and session policy

- Access tokens are HS256 JWTs with a 15-minute maximum lifetime, a unique `jti`,
  `sub` (user ID), `sid` (session ID), explicit access-token purpose, issuer and
  audience. Verification fixes the allowed algorithm and checks claims, expiry,
  not-before, future issuance and maximum lifetime.
- Each authenticated request also looks up the active, unexpired database
  session and current user. Logout/revocation and user deletion take effect on
  the next request, even before the JWT expires. Roles are read from the user
  record rather than trusted from stale JWT claims.
- Refresh credentials are opaque, cryptographically random values. PostgreSQL
  stores only their SHA-256 hashes. They are distinct from JWT access tokens.
- A session lasts at most seven days from registration/login. Refresh rotates
  the credential without extending this absolute deadline. At the deadline a
  user must log in again, even if their access JWT's nominal expiry is later.
- Rotation is a database compare-and-swap: one concurrent refresh succeeds and
  other requests using that old credential return 401. Previously consumed
  refresh credentials cannot be reused. This is not refresh-token-family reuse
  detection; reuse does not automatically revoke a legitimately rotated session.
- Clients must serialize refresh operations and save the replacement refresh
  credential. Logout must use the latest credential and be serialized with
  refresh. Repeating logout with a well-formed expired/revoked/unknown credential
  returns 204. Logout affects that session, not every device.
- Access tokens are accepted only through the Authorization header; never send
  them in URLs. The server does not log request bodies or query strings. Mobile
  clients should keep credentials in platform-protected storage. Browser cookie
  transport, CSRF configuration and origin allowlists require a separate client
  integration; this API does not set auth cookies.
- Changing the signing secret invalidates old access JWTs. Existing valid refresh
  credentials can obtain JWTs signed with the new key. This setup uses one key;
  overlapping signing-key rotation is not implemented.

## Guard and module boundaries

`AuthModule` owns identity operations and session persistence through
`AuthRepository`. Its global `JwtAuthGuard` protects mapped routes by default.
Declare intentionally public routes with `@Public()` from
`src/auth/auth.decorators.ts`. In guarded handlers, `@CurrentUser()` provides the
verified current identity and session ID; project it with `publicUser()` before
returning it.

The root, player list, match list and database health routes are explicitly public
to preserve existing schedule browsing. Future organizer/fantasy write routes
must additionally enforce league ownership/membership and business permissions.
Authentication alone does not authorize cross-league access. No admin role-
assignment API is exposed.

Auth routes are limited per client IP and handler: registration 5/minute, login
10/minute, refresh/logout 30/minute, profile 60/minute. Storage is in-process for
the current single-server setup. Before running multiple replicas, use shared
throttler storage. Proxy trust remains disabled; configure it only for known
hosting proxies so forged forwarding headers cannot bypass limits. Expired and
revoked session rows can be pruned by a future scheduled maintenance task.

## Verification

```bash
bun test test/auth.e2e.test.ts test/app.e2e.test.ts
# 41 pass, 0 fail

# Explicit isolated branch configuration, never production fallback:
bun run test:integration
# 15 pass, 0 fail during the live verification

npm run build
bun run typecheck
npm run verify:runtime
```

HTTP tests use real Argon2id and JWT libraries with a substituted persistence
boundary. They cover validation, field allowlists, default guard protection,
invalid/expired/mis-scoped tokens, absolute session expiry, refresh races/reuse,
logout and real throttling. Test signing keys are generated at runtime.

The isolated Neon suite applies the actual migration and verifies identity
uniqueness, registration, login, stored hashes, profile reads, concurrent refresh
compare-and-swap, immediate logout revocation, device-scoped sessions and database
expiry through real HTTP/database calls. Test accounts are deleted afterward.

Email verification, recovery/password changes, MFA, social sign-in, all-device
logout and authenticated organizer workflows are future work. Signup does not
prove email ownership, so invitation acceptance must not treat a matching email
as verified until verification is implemented.
