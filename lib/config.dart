/// Server base URL. Defaults to the deployed Render server, so release builds
/// work with no extra flags. Override at build/run time with:
///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000   # Android emulator -> local server
/// (Render's free tier keeps the same service domain across restarts/deploys,
/// so this default won't drift until a custom domain replaces it.)
const String apiBaseUrl = String.fromEnvironment(
  "API_BASE_URL",
  defaultValue: "https://cpa-server-3js1.onrender.com",
);
