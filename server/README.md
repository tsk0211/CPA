# CPA server

Node/Express/TypeScript API backing the CPA app (mobile + desktop, one client). MongoDB (Atlas
free M0 tier) for storage, short-lived JWT access tokens + long-lived refresh tokens for auth.
Deploys to Render's free web service tier — $0, no card required, cold-starts after 15 min idle.

## Roles

| | Owner | Admin | Analyst | Member |
|---|---|---|---|---|
| View projects & purchases | x | x | x | x |
| Add purchase | x | x | | x |
| Edit/delete purchase | x | x | | |
| Approve/reject a pending purchase | x | x | | |
| Create/rename/delete project | x | x | | |
| Export (CSV/XLSX) | x | x | x | |
| Create member/analyst accounts | x | x | | |
| Create admin accounts | x | | | |
| Deactivate admin accounts | x | | | |
| Deactivate member/analyst accounts | x | x | | |

Owner and Admin above are fixed — hardcoded, not editable or creatable through the API, the
permanent ceiling. Analyst and Member are no longer hardcoded alongside them: they're just the two
default rows the `Role` collection (`models/Role.ts`, `routes/roles.ts`) seeds on first boot, kept
at those exact ids (`"member"`/`"analyst"`) so no existing `User.role` data needed migrating.

### Custom roles

An Owner can define additional roles (`POST /roles`, Owner-only) beyond Analyst/Member — e.g. a
"Project Manager" role — as a name plus a set of permission flags
(`manageProjects`/`addPurchases`/`editPurchases`/`reviewPurchases`/`export`/`seeActivityLog`) and a
`rank`. Two things are structurally guaranteed, not just convention:

- **A custom role can never reach `manageUsers` or `manageRoles`** — those aren't fields that exist
  on a role's permission set at all, so there's no request body that could smuggle them in. Only
  the `owner`/`admin` literals ever have them.
- **`rank` is clamped server-side to always stay below Admin's**, on every create and edit — a
  custom role can be positioned anywhere below Admin, never at or above it.

Admin can assign existing roles when creating/managing users (`POST /users`, `PATCH
/users/:id/role`) but cannot create, edit, or delete a role — only list them. Deleting a role
still assigned to a user is a 409 (reassign them first, same "nothing silently orphaned" rule as
everywhere else in this app).

This is phase 1 of a larger redesign (see project memory / planning history) — project-scoped role
assignments (a role that only applies within specific projects, for e.g. a per-project Project
Manager) and the associated two-stage PM→Admin purchase review pipeline aren't built yet.

## Purchase review workflow

A purchase logged by a Member starts **pending**, not counted anywhere yet. An Owner or Admin
reviews it — `PATCH /purchases/:id/review` with `{ action: "approve" }` or
`{ action: "reject", reason }` (a reason is required to reject) — and only then does it become
`approved` (counts toward the project's `totalSpent`, and toward Reports preview/export) or
`rejected` (never counts, but is kept — nothing here is deleted, same as everywhere else in this
app). Reviewing a purchase that isn't currently `pending` is a 409, not a silent no-op — that
usually means two reviewers acted on the same item at once. `GET /purchases/pending` is the queue
itself: every pending purchase, oldest first, Owner/Admin only — this is what backs the desktop
app's Review screen.

A purchase logged by an Owner or Admin is auto-approved on creation instead of entering the queue
— they can already edit or delete any purchase outright, so making them review their own entries
would just be friction with no fraud-prevention benefit (the audit trail already covers "who
logged this").

There is exactly one Owner, ever — seeded once from env vars the first time the server boots
against an empty database (see `src/seedOwner.ts`), never created through the API. Every other
account is created by an Owner/Admin with a temp password, and must be changed on first login
(`mustChangePassword` gate — see `src/middleware/auth.ts`).

**Nothing is ever hard-deleted.** Projects, purchases, and users all use soft-delete
(`deletedAt`/`deletedBy`) — a "deleted" purchase just disappears from normal views, the original
row and value are still in the database. Every create/rename/edit/delete/role-change writes an
`AuditLog` entry with before/after values and who did it (`GET /audit-log`, Owner/Admin/Analyst
only) — this is the fraud-prevention layer.

## Pagination, search, and reporting

`GET /projects`, `GET /purchases/project/:id`, `GET /purchases/recent`, `GET /users`, and
`GET /audit-log` are all paginated (`?page=&limit=`, capped at 100/page) and return
`{ items, page, limit, total, hasMore }` rather than a bare array — projects are expected to
scale into the hundreds, so nothing here was safe to return unbounded. Projects and purchases
also support `?search=` (case-insensitive, injection-safe — see `src/pagination.ts`).

`GET /purchases/recent` is the cross-project "what's been logged lately" feed (the app's
Activity view) — not restricted to today, just most-recent-first with pagination.

`GET /audit-log?projectId=` scopes the trail to one project — its own `project.*` entries plus
every `purchase.*` entry for a purchase that ever belonged to it (including since-edited or
soft-deleted ones) — this is what backs the "Activity" section on Project Detail, as distinct
from the unscoped global trail on the Team screen.

`GET /purchases/export?format=csv|xlsx&projectIds=id1,id2&from=ISO&to=ISO&includeAuditTrail=true`
is the Reports screen's backing endpoint (Owner/Admin/Analyst only):
- Only `approved` purchases are ever included — see "Purchase review workflow" above. Reports are
  official figures; a pending or rejected purchase shows up in the Review queue, not here.
- No `projectIds` → every active project. `from`/`to` filter by `purchasedAt`.
- `format=xlsx` produces a real Excel workbook (`exceljs`) with typed columns, not just text.
- `includeAuditTrail=true` (xlsx only — csv is a single flat file) adds a second "Audit Trail"
  sheet: every project/purchase audit entry in the same scope, including entries for purchases
  that have since been edited or soft-deleted, so "who changed what" is answerable even for
  history that's no longer in the main sheet.

## Auth: access + refresh tokens

`POST /auth/login` takes `{ email, password, rememberMe? }` and returns an **access token** (a
short-lived JWT, default 15 min — `ACCESS_TOKEN_EXPIRES_IN`) and a **refresh token** (an opaque
random string, not a JWT). The client uses the access token on every request and, when it
expires, calls `POST /auth/refresh` with the refresh token to get a new pair — this should
happen silently in the background, not as a user-visible re-login.

Refresh tokens are stored server-side as a SHA-256 hash only (`models/RefreshToken.ts`), which is
what makes them individually revocable — a DB leak alone can't be replayed, and deactivating a
user (`DELETE /users/:id`) revokes all of theirs immediately, not just their currently-live access
token. Every refresh **rotates**: the old token is marked used and a new one issued
(`src/tokens.ts`). If an already-used refresh token is ever presented again — a sign it was
copied and replayed by someone else — every refresh token for that user is revoked at once,
forcing a clean re-login everywhere. `POST /auth/logout` revokes just the one token it's given.

`rememberMe: true` at login gets a 30-day refresh token (`REFRESH_TOKEN_TTL_REMEMBER_ME_DAYS`);
without it, 1 day (`REFRESH_TOKEN_TTL_DEFAULT_DAYS`) — either way the session stays refreshable,
just for a shorter window if the device isn't trusted long-term.

## Security configuration

Every security-relevant knob lives in `src/config/`, not scattered across route files:

| File | Owns |
|---|---|
| `config/env.ts` | Raw env-var reading helpers (`requireEnv`/`optionalEnv`/`optionalNumber`) |
| `config/security.ts` | JWT secret, access/refresh token lifetimes, bcrypt cost, min password length, CORS origins, login rate limit |
| `config/server.ts` | Port, `NODE_ENV`, Mongo URI |
| `config/owner.ts` | The one-time Owner-seed credentials |
| `config/index.ts` | Barrel re-export — `import { securityConfig, serverConfig } from "./config/index.js"` |

Every value has a default (see `.env.example`) except the secrets, which fail loudly on startup
if missing rather than silently running insecurely. `JWT_SECRET` specifically is rejected below
32 characters. `POST /auth/login` is rate-limited (`LOGIN_RATE_LIMIT_*`, default 10/15min per IP)
and the app sends `helmet()`'s security headers on every response.

## Setup

```bash
cp .env.example .env
# fill in MONGODB_URI, JWT_SECRET, and OWNER_NAME/OWNER_EMAIL/OWNER_PASSWORD
# (see the comments in .env.example for what each optional var does)

npm install
npm run dev        # http://localhost:4000
```

## Test

```bash
npm test           # spins up a real in-memory MongoDB and exercises every role/permission
                    # path, the password-change gate, soft-delete, the audit trail, refresh
                    # token rotation + reuse detection, pagination/search, csv+xlsx export
                    # (including the audit-trail sheet), the login rate limiter, and the
                    # purchase review workflow (pending -> approve/reject, the review queue,
                    # and totals/exports only reflecting approved purchases)
```

## Deploy (Render free tier, $0)

`render.yaml` in this directory is a Render Blueprint — deploy declaratively instead of clicking
through dashboard settings by hand:

1. Push this repo to GitHub/GitLab.
2. Render dashboard -> New -> Blueprint -> connect the repo. Render reads `server/render.yaml`
   and proposes the `cpa-server` web service (free plan, Node runtime, health check on
   `/health`).
3. Render will prompt for the env vars marked `sync: false` in `render.yaml` — that's
   `MONGODB_URI`, `JWT_SECRET`, `OWNER_NAME`, `OWNER_EMAIL`, `OWNER_PASSWORD`. Fill those in;
   everything else already has a value from the blueprint.
4. Deploy. First boot seeds the Owner account automatically, then the blueprint's env vars are
   the only source of truth going forward — nothing security-relevant lives in committed code.
5. Free-tier services sleep after 15 min idle; the first request after a lull takes ~30s to wake
   up. Fine for a demo, not for production — that's the upgrade conversation once the client
   pays.
