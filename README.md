# CPA — Cash Purchase Accounting

Flutter app (iOS + Android + Windows/macOS/Linux/web) for a team to track cash purchases across
multiple projects, centrally — see `server/README.md` for the backend (roles, auth, audit trail,
exports). Every user runs the same app and the same codebase; the desktop-width layout is a
different arrangement of the same screens, not a separate build.

## Desktop, and the review/approval workflow

Anyone can run the app on desktop, but its extra screen real estate is aimed at Owner/Admin: a
`NavigationRail` replaces the phone's bottom nav once the window is ≥900px wide (`lib/widgets/
breakpoints.dart`), Projects/Team render as sortable `DataTable`s instead of scrolling list tiles,
and two desktop-first pieces round it out:

- **Dashboard** (`lib/screens/dashboard_screen.dart`) — a desktop-only landing page (mirroring the
  decision, already made for the mobile Activity tab, that a "Today"-style landing screen doesn't
  belong on the phone). Stat tiles (active projects, this month's approved spend, pending review
  count, team size — each trimmed to what the viewer's role can actually see) plus a recent-
  activity list. No charts, on purpose — same call as Reports (see below).
- **Review** (`lib/screens/review_screen.dart`) — the admin review queue this whole desktop push
  was really for. A Member's purchase now starts **pending** instead of counting immediately:
  Owner/Admin clear the queue here (desktop: a data table; mobile: cards — Owner/Admin can also
  review from the Project Detail purchases list, and from their phone), approving or rejecting
  with a required reason. Only approved purchases count toward a project's total or show up in
  Reports — see `server/README.md` for the full rule. Owner/Admin's own purchases are
  auto-approved; they could already edit/delete anything outright, so making them review their own
  entries would just be friction.

## Core loop

- **Projects** is the landing screen — paginated + searchable, ready for 100+ projects. Each
  project has a picked emoji icon and a running total.
- Open a project to see its purchase history (paginated + searchable) and, for Owner/Admin/
  Analyst, an **Activity** tab — that project's own audit trail (who created/edited/deleted what).
- The top bar's Activity icon is a separate, cross-project "what's been logged lately" feed —
  deliberately not the landing screen (see project memory: an earlier "Today" tab as the front
  door was reconsidered as bad design).
- **Reports** (Owner/Admin/Analyst): date-range + searchable multi-project filters, export to
  CSV or a real `.xlsx` workbook, optionally with a second "audit trail" sheet for the same scope.
- **Team** (Owner/Admin full; Analyst sees it but only the Activity tab): provision accounts with
  a temp password, change roles, deactivate — all permission-gated to match the server's role
  matrix (`server/README.md`).

## Roles affect the UI directly

Every role-gated action in `server/` (add/edit/delete purchase, manage projects, export, manage
users, review a pending purchase) has a matching `Role` getter in `lib/models/role.dart` that
hides/disables the corresponding button — Member never sees an edit/delete swipe action, Analyst
never sees an "add purchase" button, Member/Analyst never see the Review destination, etc. The
server still enforces all of this independently; the client-side gating is about not showing
controls that would just 403, not the actual security boundary.

## Auth

Login has a "Remember me" checkbox (see server's access+refresh token design). Accounts are
Owner/Admin-provisioned only — no self-signup — and a temp password forces a "set your own
password" screen before anything else is reachable.

## Offline

Only **adding a purchase** works offline — the one write a Member is expected to make in the
field. It queues locally (`lib/offline/`) and flushes automatically once connectivity returns
(checked on connectivity change and app resume). Edits, deletes, and project/user management all
require a live connection, by design — see project memory for why that scope line was drawn
there (avoids conflict-resolution complexity for a fraud-sensitive edit trail).

## Stack

- Flutter (Dart), Material 3.
- `http` + a hand-rolled `ApiClient` (`lib/api/`) — access/refresh token handling, automatic
  silent refresh-and-retry on an expired access token.
- `flutter_secure_storage` for tokens, `shared_preferences` for the offline purchase queue.
- No local database — the server (MongoDB) is the source of truth; the offline queue is a
  temporary outbox, not a cache of everything.

## Run it

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000   # Android emulator -> local server
# or point at the deployed Render URL once server/ is deployed (see server/README.md)

# Desktop (any platform Flutter is configured for here — windows/macos/linux/web all scaffolded):
flutter run -d windows --dart-define=API_BASE_URL=http://localhost:4000
flutter run -d chrome  --dart-define=API_BASE_URL=http://localhost:4000
```

## Tests

```bash
flutter test          # widget smoke test (mocks the platform channels: secure storage,
                       # shared_preferences, connectivity)
flutter analyze
```

The model-parsing layer (`lib/models/`) was also verified against the real server's actual JSON
shapes with a throwaway integration script during development — not just trusted from reading the
backend code. It caught a real bug (`server/`'s totals aggregation silently returning 0) that 45
backend-only smoke checks had missed.

## Deliberately not built yet

- Editing/undo for anything beyond purchases (project/user edits have no "undo," just soft-delete
  + audit trail).
- Push notifications.
- Charts in Reports — deliberately scoped to filterable tables + export rather than visualizations
  (user's call — see project memory).
- iOS-specific polish (only `flutter analyze`/`flutter test` run on this machine; no Mac available
  for a real iOS simulator/device run).
