import '../models/audit_entry.dart';
import '../models/paged.dart';
import 'api_client.dart';

class AuditApi {
  final ApiClient client;
  AuditApi(this.client);

  Future<Paged<AuditEntry>> list({
    int page = 1,
    int limit = 20,
    String? projectId,
    String? actorId,
    String? action,
    DateTime? from,
    DateTime? to,
  }) async {
    final json = await client.get("/audit-log", query: {
      "page": "$page",
      "limit": "$limit",
      "projectId": ?projectId,
      "actorId": ?actorId,
      "action": ?action,
      if (from != null) "from": from.toIso8601String(),
      if (to != null) "to": to.toIso8601String(),
    });
    return Paged.fromJson(json, AuditEntry.fromJson);
  }

  // Same filters as list(), no pagination — the whole matching set as one
  // .xlsx workbook.
  Future<(List<int> bytes, String filename)> export({
    String? projectId,
    String? actorId,
    String? action,
    DateTime? from,
    DateTime? to,
  }) {
    return client.getBytes("/audit-log/export", query: {
      "projectId": ?projectId,
      "actorId": ?actorId,
      "action": ?action,
      if (from != null) "from": from.toIso8601String(),
      if (to != null) "to": to.toIso8601String(),
    });
  }
}
