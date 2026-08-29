class Project {
  final String id;
  final String name;
  final String icon;
  final String createdBy;
  final DateTime createdAt;
  final double totalSpent;

  Project({
    required this.id,
    required this.name,
    required this.icon,
    required this.createdBy,
    required this.createdAt,
    required this.totalSpent,
  });

  factory Project.fromJson(Map<String, dynamic> json) => Project(
        id: json["_id"] as String,
        name: json["name"] as String,
        icon: json["icon"] as String? ?? "📁",
        createdBy: json["createdBy"] as String,
        createdAt: DateTime.parse(json["createdAt"] as String),
        totalSpent: (json["totalSpent"] as num?)?.toDouble() ?? 0,
      );
}
