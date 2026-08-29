# CPA server

Node/Express/TypeScript API backing the CPA mobile app. MongoDB (Atlas free M0 tier) for storage,
JWT for auth. Deploys to Render's free web service tier — $0, no card required, cold-starts
after 15 min idle.

## Roles

| | Owner | Admin | Analyst | Member |
|---|---|---|---|---|
| View projects & purchases | x | x | x | x |
| Add purchase | x | x | | x |
| Edit/delete purchase | x | x | | |
| Create/rename/delete project | x | x | | |
| Export (CSV) | x | x | x | |
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

## Setup

```bash
cp .env.example .env
# edit .env: MONGODB_URI (Atlas free cluster), JWT_SECRET (openssl rand -hex 32),
# OWNER_NAME / OWNER_EMAIL / OWNER_PASSWORD (only used once, on first boot)

npm install
npm run dev        # http://localhost:4000
```

## Test

```bash
npm test           # spins up a real in-memory MongoDB and exercises every role/permission path
```

## Deploy (Render free tier)

1. Push this repo to GitHub.
2. Render dashboard -> New -> Web Service -> connect the repo, root directory `server`.
3. Build command: `npm install && npm run build`. Start command: `npm start`.
4. Add the same env vars as `.env` in Render's dashboard (never commit `.env`).
5. First deploy seeds the Owner account automatically from `OWNER_*` env vars.
