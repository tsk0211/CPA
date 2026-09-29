/// Shared between `Session` (which drives it during bootstrap) and any
/// widget showing it (`ServerStatusLight` on Login, `ServerWakingView` for
/// session restore) — kept dependency-free so state code doesn't need to
/// import Flutter just for this enum.
enum ServerStatus { idle, waking, live }
