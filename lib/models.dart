class Project {
  final int? id;
  final String name;
  final DateTime createdAt;

  Project({this.id, required this.name, required this.createdAt});

  Map<String, Object?> toMap() => {
        'id': id,
        'name': name,
        'created_at': createdAt.toIso8601String(),
      };

  factory Project.fromMap(Map<String, Object?> map) => Project(
        id: map['id'] as int,
        name: map['name'] as String,
        createdAt: DateTime.parse(map['created_at'] as String),
      );
}

class Purchase {
  final int? id;
  final int projectId;
  final double amount;
  final String description;
  final DateTime purchasedAt;

  Purchase({
    this.id,
    required this.projectId,
    required this.amount,
    required this.description,
    required this.purchasedAt,
  });

  Map<String, Object?> toMap() => {
        'id': id,
        'project_id': projectId,
        'amount': amount,
        'description': description,
        'purchased_at': purchasedAt.toIso8601String(),
      };

  factory Purchase.fromMap(Map<String, Object?> map) => Purchase(
        id: map['id'] as int,
        projectId: map['project_id'] as int,
        amount: (map['amount'] as num).toDouble(),
        description: map['description'] as String,
        purchasedAt: DateTime.parse(map['purchased_at'] as String),
      );
}
