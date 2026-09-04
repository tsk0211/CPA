import '../models/audit_entry.dart';
import '../models/paged.dart';
import 'api_client.dart';

class AuditApi {
  final ApiClient client;
  AuditApi(this.client);

  Future<Paged<AuditEntry>> list({int page = 1, int limit = 20, String? projectId, String? action}) async {
    final json = await client.get("/audit-log", query: {
      "page": "$page",
      "limit": "$limit",
      "projectId": ?projectId,
      "action": ?action,
    });
    return Paged.fromJson(json, AuditEntry.fromJson);
  }
}
