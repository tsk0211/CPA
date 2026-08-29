import 'dart:math';

class PendingPurchase {
  final String localId;
  final String projectId;
  final String projectName;
  final double amount;
  final String description;
  final double? quantity;
  final String? unit;
  final String? vendor;
  final String? category;
  final String? notes;
  final DateTime createdAtLocal;

  PendingPurchase({
    required this.localId,
    required this.projectId,
    required this.projectName,
    required this.amount,
    required this.description,
    this.quantity,
    this.unit,
    this.vendor,
    this.category,
    this.notes,
    required this.createdAtLocal,
  });

  /// Doubles as this purchase's server-side idempotency key — a retried
  /// sync of the same pending item (dropped response, re-run after a
  /// crash) always carries the same localId, so the server returns the
  /// original purchase instead of creating a duplicate.
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
        "quantity": quantity,
        "unit": unit,
        "vendor": vendor,
        "category": category,
        "notes": notes,
        "createdAtLocal": createdAtLocal.toIso8601String(),
      };

  factory PendingPurchase.fromJson(Map<String, dynamic> json) => PendingPurchase(
        localId: json["localId"] as String,
        projectId: json["projectId"] as String,
        projectName: json["projectName"] as String,
        amount: (json["amount"] as num).toDouble(),
        description: json["description"] as String,
        quantity: (json["quantity"] as num?)?.toDouble(),
        unit: json["unit"] as String?,
        vendor: json["vendor"] as String?,
        category: json["category"] as String?,
        notes: json["notes"] as String?,
        createdAtLocal: DateTime.parse(json["createdAtLocal"] as String),
      );
}
