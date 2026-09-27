enum PurchaseStatus {
  pending,
  approved,
  rejected;

  static PurchaseStatus parse(String? raw) => PurchaseStatus.values.firstWhere((s) => s.name == raw, orElse: () => PurchaseStatus.approved);
}

class Purchase {
  final String id;
  final String projectId;
  final String? projectName;
  final String? projectIcon;
  final double amount;
  final String description;
  final double? quantity;
  final String? unit;
  final String? vendor;
  final String? category;
  final String? notes;
  final String createdBy;
  final String? createdByName;
  final DateTime purchasedAt;
  final DateTime? editedAt;
  final PurchaseStatus status;
  final String? rejectionReason;
  final bool capturedOffline;

  Purchase({
    required this.id,
    required this.projectId,
    this.projectName,
    this.projectIcon,
    required this.amount,
    required this.description,
    this.quantity,
    this.unit,
    this.vendor,
    this.category,
    this.notes,
    required this.createdBy,
    this.createdByName,
    required this.purchasedAt,
    this.editedAt,
    this.status = PurchaseStatus.approved,
    this.rejectionReason,
    this.capturedOffline = false,
  });

  // projectId/createdBy come back as plain string ids from
  // /purchases/project/:id, but populated {_id,name,...} objects from
  // /purchases/recent — handle both shapes.
  factory Purchase.fromJson(Map<String, dynamic> json) {
    final rawProject = json["projectId"];
    final rawCreatedBy = json["createdBy"];

    return Purchase(
      id: json["_id"] as String,
      projectId: rawProject is Map ? rawProject["_id"] as String : rawProject as String,
      projectName: rawProject is Map ? rawProject["name"] as String? : null,
      projectIcon: rawProject is Map ? rawProject["icon"] as String? : null,
      amount: (json["amount"] as num).toDouble(),
      description: json["description"] as String,
      quantity: (json["quantity"] as num?)?.toDouble(),
      unit: json["unit"] as String?,
      vendor: json["vendor"] as String?,
      category: json["category"] as String?,
      notes: json["notes"] as String?,
      createdBy: rawCreatedBy is Map ? rawCreatedBy["_id"] as String : rawCreatedBy as String,
      createdByName: rawCreatedBy is Map ? rawCreatedBy["name"] as String? : null,
      purchasedAt: DateTime.parse(json["purchasedAt"] as String),
      editedAt: json["editedAt"] != null ? DateTime.parse(json["editedAt"] as String) : null,
      status: PurchaseStatus.parse(json["status"] as String?),
      rejectionReason: json["rejectionReason"] as String?,
      capturedOffline: json["capturedOffline"] as bool? ?? false,
    );
  }
}
