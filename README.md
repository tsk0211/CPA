# CPA — Cash Purchase Accounting

Mobile app (Flutter, iOS + Android) for tracking cash purchases across multiple projects,
day by day.

## Core loop

- Create a **project**.
- Log a **cash purchase** against a project: amount + what it was for. Timestamped automatically.
- **Today** tab shows every purchase logged today across all projects, with a running total —
  the daily cross-project view.
- Each project also has its own detail screen with its full purchase history and running total.

## Stack

- Flutter (Dart), Material 3.
- Local persistence via `sqflite` (SQLite) — works fully offline, no backend, no account needed.
  This is what "works globally" means for v1: no server dependency, no region lock-in.

## Run it

```bash
flutter pub get
flutter run          # needs a connected device or emulator
```

## Tests

```bash
flutter test          # db layer + a smoke test that the app launches
flutter analyze
```

## Deliberately not built yet

- Editing/undo beyond swipe-to-delete on purchases.
- Multi-currency, multi-user, or sync to a backend.
- Charts/reports beyond the daily and per-project totals.
- iOS-specific polish (only smoke-tested against `flutter analyze`/`flutter test` on this
  machine, no Mac available to run on a real iOS device/simulator).
