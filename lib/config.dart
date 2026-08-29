/// Server base URL. Override at build/run time with:
///   flutter run --dart-define=API_BASE_URL=https://cpa-server.onrender.com
/// Defaults to the Android emulator's host-loopback address for local dev
/// against `npm run dev` in server/ — swap for your device's LAN IP or the
/// deployed Render URL as needed.
const String apiBaseUrl = String.fromEnvironment(
  "API_BASE_URL",
  defaultValue: "http://10.0.2.2:4000",
);
