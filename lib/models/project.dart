class Project {
  final String id;
  final String name;
  final String icon;
  final String createdBy;
  final DateTime createdAt;
  final double totalSpent;
  // A Member's purchase at or under this amount auto-approves instead of
  // entering the review queue. Owner/Admin manage this per project.
  final double autoApproveThreshold;

  Project({
    required this.id,
    required this.name,
    required this.icon,
    required this.createdBy,
    required this.createdAt,
    required this.totalSpent,
    required this.autoApproveThreshold,
  });

  factory Project.fromJson(Map<String, dynamic> json) => Project(
        id: json["_id"] as String,
        name: json["name"] as String,
        icon: json["icon"] as String? ?? "📁",
        createdBy: json["createdBy"] as String,
        createdAt: DateTime.parse(json["createdAt"] as String),
        totalSpent: (json["totalSpent"] as num?)?.toDouble() ?? 0,
        autoApproveThreshold: (json["autoApproveThreshold"] as num?)?.toDouble() ?? 0,
      );

  Map<String, dynamic> toJson() => {
        "_id": id,
        "name": name,
        "icon": icon,
        "createdBy": createdBy,
        "createdAt": createdAt.toIso8601String(),
        "totalSpent": totalSpent,
        "autoApproveThreshold": autoApproveThreshold,
      };
}
