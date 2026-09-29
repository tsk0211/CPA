class AuditEntry {
  final String id;
  final String actorName;
  final String actorRole;
  final String action;
  final String entityType;
  final String entityId;
  final Map<String, dynamic>? before;
  final Map<String, dynamic>? after;
  final DateTime createdAt;

  AuditEntry({
    required this.id,
    required this.actorName,
    required this.actorRole,
    required this.action,
    required this.entityType,
    required this.entityId,
    this.before,
    this.after,
    required this.createdAt,
  });

  factory AuditEntry.fromJson(Map<String, dynamic> json) => AuditEntry(
        id: json["_id"] as String,
        actorName: json["actorName"] as String,
        actorRole: json["actorRole"] as String,
        action: json["action"] as String,
        entityType: json["entityType"] as String,
        entityId: json["entityId"] as String,
        before: json["before"] as Map<String, dynamic>?,
        after: json["after"] as Map<String, dynamic>?,
        // The server always sends UTC (Mongoose Dates serialize with a 'Z'
        // suffix) — converting to local here, once, at the data boundary,
        // means every display site downstream (DateFormat.format(...)) just
        // works without each one remembering to call .toLocal() itself.
        createdAt: DateTime.parse(json["createdAt"] as String).toLocal(),
      );
}
