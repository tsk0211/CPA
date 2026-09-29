import 'package:intl/intl.dart';

/// Holds the server-configured currency code (see ConfigApi/GET /config) for
/// every screen's currency formatting to read — set once at session
/// bootstrap/login from the cached value, then refreshed from the network.
/// Deliberately not inferred from device locale: NumberFormat
/// .simpleCurrency() with no `name` guesses from whatever locale the device
/// reports, which is how this app ended up silently showing USD ($) for
/// users in India.
class AppCurrency {
  AppCurrency._();

  // INR default matches the server's own default (config/app.ts) — used
  // only until a cached or fetched value is available (e.g. this device's
  // very first launch, before bootstrap's cache/network calls resolve).
  static String code = "INR";
}

NumberFormat currencyFormat() =>
    NumberFormat.simpleCurrency(name: AppCurrency.code);

NumberFormat compactCurrencyFormat() =>
    NumberFormat.compactSimpleCurrency(name: AppCurrency.code);

/// Just the symbol (e.g. "₹", "$") for use as a TextField's prefixText —
/// two sheets in this app had this hardcoded (one to "$", one to "₹",
/// disagreeing with each other) instead of deriving it the same way the
/// rest of the app formats money.
String currencySymbol() => "${currencyFormat().currencySymbol} ";
