# CPA server

Node/Express/TypeScript API backing the CPA mobile app. MongoDB (Atlas free M0 tier) for storage,
short-lived JWT access tokens + long-lived refresh tokens for auth. Deploys to Render's free web
service tier — $0, no card required, cold-starts after 15 min idle.

## Roles

| | Owner | Admin | Analyst | Member |
|---|---|---|---|---|
| View projects & purchases | x | x | x | x |
| Add purchase | x | x | | x |
| Edit/delete purchase | x | x | | |
| Create/rename/delete project | x | x | | |
| Export (CSV/XLSX) | x | x | x | |
| Create member/analyst accounts | x | x | | |
| Create admin accounts | x | | | |
| Deactivate admin accounts | x | | | |
| Deactivate member/analyst accounts | x | x | | |

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

`GET /purchases/export?format=csv|xlsx&projectIds=id1,id2&from=ISO&to=ISO&includeAuditTrail=true`
is the Reports screen's backing endpoint (Owner/Admin/Analyst only):
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
                    # (including the audit-trail sheet), and the login rate limiter
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
