import '../models/paged.dart';
import '../models/purchase.dart';
import 'api_client.dart';

class PurchasesApi {
  final ApiClient client;
  PurchasesApi(this.client);

  Future<Paged<Purchase>> forProject(String projectId, {int page = 1, int limit = 20, String? search}) async {
    final json = await client.get("/purchases/project/$projectId", query: {
      "page": "$page",
      "limit": "$limit",
      if (search != null && search.isNotEmpty) "search": search,
    });
    return Paged.fromJson(json, Purchase.fromJson);
  }

  Future<Paged<Purchase>> recent({int page = 1, int limit = 20, String? search}) async {
    final json = await client.get("/purchases/recent", query: {
      "page": "$page",
      "limit": "$limit",
      if (search != null && search.isNotEmpty) "search": search,
    });
    return Paged.fromJson(json, Purchase.fromJson);
  }

  // idempotencyKey is required: a retry of the exact same key (dropped
  // response, re-synced offline item) returns the original purchase
  // instead of creating a duplicate — see server/src/routes/purchases.ts.
  Future<Purchase> create({
    required String projectId,
    required double amount,
    required String description,
    required String idempotencyKey,
    double? quantity,
    String? unit,
    String? vendor,
    String? category,
    String? notes,
  }) async {
    final json = await client.post("/purchases", {
      "projectId": projectId,
      "amount": amount,
      "description": description,
      "idempotencyKey": idempotencyKey,
      if (quantity != null) "quantity": quantity,
      if (unit != null) "unit": unit,
      if (vendor != null) "vendor": vendor,
      if (category != null) "category": category,
      if (notes != null) "notes": notes,
    });
    return Purchase.fromJson(json);
  }

  Future<Purchase> update(
    String id, {
    double? amount,
    String? description,
    double? quantity,
    String? unit,
    String? vendor,
    String? category,
    String? notes,
  }) async {
    final json = await client.patch("/purchases/$id", {
      if (amount != null) "amount": amount,
      if (description != null) "description": description,
      if (quantity != null) "quantity": quantity,
      if (unit != null) "unit": unit,
      if (vendor != null) "vendor": vendor,
      if (category != null) "category": category,
      if (notes != null) "notes": notes,
    });
    return Purchase.fromJson(json);
  }

  Future<void> delete(String id) => client.delete("/purchases/$id");

  Future<(List<int> bytes, String filename)> export({
    required String format,
    List<String>? projectIds,
    DateTime? from,
    DateTime? to,
    bool includeAuditTrail = false,
  }) {
    return client.getBytes("/purchases/export", query: {
      "format": format,
      if (projectIds != null && projectIds.isNotEmpty) "projectIds": projectIds.join(","),
      if (from != null) "from": from.toIso8601String(),
      if (to != null) "to": to.toIso8601String(),
      if (includeAuditTrail) "includeAuditTrail": "true",
    });
  }
}
