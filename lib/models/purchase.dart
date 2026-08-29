class Purchase {
  final String id;
  final String projectId;
  final String? projectName;
  final String? projectIcon;
  final double amount;
  final String description;
  final String createdBy;
  final String? createdByName;
  final DateTime purchasedAt;
  final DateTime? editedAt;

  Purchase({
    required this.id,
    required this.projectId,
    this.projectName,
    this.projectIcon,
    required this.amount,
    required this.description,
    required this.createdBy,
    this.createdByName,
    required this.purchasedAt,
    this.editedAt,
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
      createdBy: rawCreatedBy is Map ? rawCreatedBy["_id"] as String : rawCreatedBy as String,
      createdByName: rawCreatedBy is Map ? rawCreatedBy["name"] as String? : null,
      purchasedAt: DateTime.parse(json["purchasedAt"] as String),
      editedAt: json["editedAt"] != null ? DateTime.parse(json["editedAt"] as String) : null,
    );
  }
}
