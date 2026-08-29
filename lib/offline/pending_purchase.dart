import 'dart:math';

class PendingPurchase {
  final String localId;
  final String projectId;
  final String projectName;
  final double amount;
  final String description;
  final DateTime createdAtLocal;

  PendingPurchase({
    required this.localId,
    required this.projectId,
    required this.projectName,
    required this.amount,
    required this.description,
    required this.createdAtLocal,
  });

  static String newLocalId() {
    final rand = Random().nextInt(1 << 32).toRadixString(16);
    return "local-${DateTime.now().microsecondsSinceEpoch}-$rand";
  }

  Map<String, dynamic> toJson() => {
        "localId": localId,
        "projectId": projectId,
        "projectName": projectName,
        "amount": amount,
        "description": description,
        "createdAtLocal": createdAtLocal.toIso8601String(),
      };

  factory PendingPurchase.fromJson(Map<String, dynamic> json) => PendingPurchase(
        localId: json["localId"] as String,
        projectId: json["projectId"] as String,
        projectName: json["projectName"] as String,
        amount: (json["amount"] as num).toDouble(),
        description: json["description"] as String,
        createdAtLocal: DateTime.parse(json["createdAtLocal"] as String),
      );
}
