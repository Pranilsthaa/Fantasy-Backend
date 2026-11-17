# Checkpoint 1: leagues and tournament editions

Any authenticated user can create a cricket league. Its creator is the owner.
Existing users may be assigned league admin/scorer roles by username. These
roles are scoped to one league, independently of the user's global account role.
All routes below require a bearer access JWT and are documented in Swagger.

| Method | Route | Permission |
| --- | --- | --- |
| POST | `/api/leagues` | Any authenticated user |
| GET | `/api/leagues` | Own leagues and active staff memberships |
| GET | `/api/leagues/:leagueId` | Owner/admin/scorer |
| PATCH | `/api/leagues/:leagueId` | Owner |
| GET | `/api/leagues/:leagueId/staff` | Owner |
| PUT | `/api/leagues/:leagueId/staff` | Owner |
| DELETE | `/api/leagues/:leagueId/staff/:userId` | Owner |
| POST | `/api/leagues/:leagueId/tournaments` | Owner/admin |
| GET | `/api/leagues/:leagueId/tournaments` | Owner/admin/scorer |
| GET | `/api/leagues/:leagueId/tournaments/:tournamentId` | Owner/admin/scorer |
| PATCH | `/api/leagues/:leagueId/tournaments/:tournamentId` | Owner/admin, drafts only |

## Payloads and behavior

Create a league with `name` and optional `location`. The server assigns its owner,
fixes the sport to cricket, and generates a unique slug. Editing its name does
not change that slug. League editing is owner-only.

Assign staff with `{ "username": "registered_username", "role": "admin" }`
or role `scorer`. Assignment updates an existing membership or reactivates a
removed one. The owner cannot be assigned a staff role or removed. Staff removal
deactivates membership rather than deleting history; repeating removal returns
204. Staff responses contain user ID, username and league role, not email or
password hashes. Only the owner can list/change staff.

Create a tournament with `name`, `season`, optional `timezone`, and optional
`startsAt`/`endsAt`. The timezone defaults to `Asia/Kathmandu`. Supplied timestamps
must be ISO timestamps with an explicit timezone; end must not precede start.
The date range is validated against existing values on partial edits as well.
The IANA timezone is validated. Updates lock the tournament row while checking
its current dates/status so concurrent edits cannot invalidate the date range.

Each league has at most one edition for a given season string. Different leagues
may use the same season. New editions are always drafts, and only drafts may be
edited. Status transitions are intentionally outside this checkpoint.

All list routes accept `?page=1` and return `{ data, page, pageSize: 20 }` with
stable ordering. My Leagues currently includes ownership and active staff roles;
fantasy-player participation will be added with the participant workflows.
Unknown input fields, nulls, malformed UUIDs, invalid pagination and empty updates
are rejected. Outsiders receive 404 for private league resources; staff attempting
an owner-only operation receive 403. Global administrators have no automatic
league access. Removing staff prevents access on subsequent requests.

## Verification and next checkpoint

The real PostgreSQL test exercises all eleven new operations through HTTP:
creation, private-list filtering, owner/admin/scorer permissions, global-admin
isolation, staff removal/reactivation, duplicate seasons, cross-league tournament
IDs, draft-only updates, date/timezone validation and server-controlled fields.
It cleans up its test users, sessions, leagues and tournaments on the isolated
verification branch. No production records or schema were changed.

Existing API/auth tests pass. Swagger tests cover all protected operations and
explicit required UUID path parameters in Bun source mode. Build and typecheck
also pass. No new dependencies, schema migrations or background services.

Next checkpoint: register teams and players for a tournament. Participant invites,
fixtures, activation, fantasy squads, transfers and scoring remain later work.
