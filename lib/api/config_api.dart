import 'api_client.dart';

/// GET /config — public, unauthenticated app-display config (currency code
/// today). Deliberately not guessed from device locale: NumberFormat
/// .simpleCurrency() with no name infers from whatever locale the device
/// reports, which silently showed USD ($) instead of the real currency.
class ConfigApi {
  final ApiClient client;
  ConfigApi(this.client);

  Future<String> getCurrencyCode() async {
    final json = await client.get("/config");
    return json["currencyCode"] as String;
  }
}
