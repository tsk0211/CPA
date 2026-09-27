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
  // capturedOffline: set when this purchase was queued locally while
  // offline and is only now being synced — the server forces it to
  // "pending" regardless of role/auto-approve threshold in that case, since
  // it hasn't been checked against the server's current state. See
  // OfflineQueue.sync(), which is the only caller that ever passes true.
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
    bool capturedOffline = false,
  }) async {
    final json = await client.post("/purchases", {
      "projectId": projectId,
      "amount": amount,
      "description": description,
      "idempotencyKey": idempotencyKey,
      "quantity": ?quantity,
      "unit": ?unit,
      "vendor": ?vendor,
      "category": ?category,
      "notes": ?notes,
      "capturedOffline": capturedOffline,
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
      "amount": ?amount,
      "description": ?description,
      "quantity": ?quantity,
      "unit": ?unit,
      "vendor": ?vendor,
      "category": ?category,
      "notes": ?notes,
    });
    return Purchase.fromJson(json);
  }

  Future<void> delete(String id) => client.delete("/purchases/$id");

  // The desktop admin review queue: every pending purchase across all
  // projects, oldest first. Owner/Admin only — see server/src/routes/purchases.ts.
  Future<Paged<Purchase>> pending({int page = 1, int limit = 20}) async {
    final json = await client.get("/purchases/pending", query: {"page": "$page", "limit": "$limit"});
    return Paged.fromJson(json, Purchase.fromJson);
  }

  Future<Purchase> approve(String id) async {
    final json = await client.patch("/purchases/$id/review", {"action": "approve"});
    return Purchase.fromJson(json);
  }

  Future<Purchase> reject(String id, String reason) async {
    final json = await client.patch("/purchases/$id/review", {"action": "reject", "reason": reason});
    return Purchase.fromJson(json);
  }

  // Same filters as export(), paginated — lets the Reports screen show what
  // an export would contain before the user commits to generating one.
  Future<(Paged<Purchase> paged, double totalAmount)> search({
    int page = 1,
    int limit = 20,
    List<String>? projectIds,
    DateTime? from,
    DateTime? to,
  }) async {
    final json = await client.get("/purchases/search", query: {
      "page": "$page",
      "limit": "$limit",
      if (projectIds != null && projectIds.isNotEmpty) "projectIds": projectIds.join(","),
      if (from != null) "from": from.toIso8601String(),
      if (to != null) "to": to.toIso8601String(),
    });
    return (Paged.fromJson(json, Purchase.fromJson), (json["totalAmount"] as num?)?.toDouble() ?? 0);
  }

  // Daily approved-spend totals for the trailing [days] days, zero-filled —
  // feeds the Dashboard's spend trend chart. Same scoping as search()/export().
  Future<List<(DateTime, double)>> trend({int days = 30, List<String>? projectIds}) async {
    final offset = DateTime.now().timeZoneOffset;
    final sign = offset.isNegative ? "-" : "+";
    final abs = offset.abs();
    final tzOffset = "$sign${abs.inHours.toString().padLeft(2, '0')}:${(abs.inMinutes % 60).toString().padLeft(2, '0')}";

    final json = await client.get("/purchases/trend", query: {
      "days": "$days",
      "tzOffset": tzOffset,
      if (projectIds != null && projectIds.isNotEmpty) "projectIds": projectIds.join(","),
    });
    final points = (json["points"] as List).cast<Map<String, dynamic>>();
    return [for (final p in points) (DateTime.parse(p["date"] as String), (p["total"] as num).toDouble())];
  }

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
