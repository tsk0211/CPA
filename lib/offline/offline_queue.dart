import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_exception.dart';
import '../api/purchases_api.dart';
import 'pending_purchase.dart';

const _storageKey = "cpa_pending_purchases";

class SyncResult {
  final int synced;
  final List<String> failures;
  SyncResult(this.synced, this.failures);
}

/// Local outbox for purchases added while offline. Deliberately scoped to
/// "add a purchase" only — edits/deletes/project management all require a
/// live connection, so there's no conflict-resolution to worry about here,
/// just an ordered list of creates waiting to be replayed.
class OfflineQueue extends ChangeNotifier {
  List<PendingPurchase> _pending = [];
  bool _syncing = false;

  List<PendingPurchase> get pending => List.unmodifiable(_pending);
  bool get hasPending => _pending.isNotEmpty;
  bool get isSyncing => _syncing;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_storageKey);
    if (raw == null) return;
    final list = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
    _pending = list.map(PendingPurchase.fromJson).toList();
    notifyListeners();
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageKey, jsonEncode(_pending.map((p) => p.toJson()).toList()));
  }

  Future<void> add(PendingPurchase purchase) async {
    _pending.add(purchase);
    await _persist();
    notifyListeners();
  }

  /// Tries to flush the queue to the server, in the order items were
  /// created. Stops the moment it hits a network failure (rest stay
  /// queued for next time); a purchase the server actually rejects (e.g.
  /// its project was deleted in the meantime) is dropped with its error
  /// recorded rather than retried forever.
  Future<SyncResult> sync(PurchasesApi api) async {
    if (_syncing || _pending.isEmpty) return SyncResult(0, []);
    _syncing = true;
    notifyListeners();

    var synced = 0;
    final failures = <String>[];

    try {
      final queue = List<PendingPurchase>.from(_pending);
      for (final item in queue) {
        try {
          await api.create(
            projectId: item.projectId,
            amount: item.amount,
            description: item.description,
            idempotencyKey: item.localId,
            quantity: item.quantity,
            unit: item.unit,
            vendor: item.vendor,
            category: item.category,
            notes: item.notes,
          );
          _pending.removeWhere((p) => p.localId == item.localId);
          synced++;
          await _persist();
        } on NetworkUnavailableException {
          break;
        } on ApiException catch (e) {
          failures.add("${item.description} (${item.projectName}): ${e.message}");
          _pending.removeWhere((p) => p.localId == item.localId);
          await _persist();
        }
      }
    } finally {
      _syncing = false;
      notifyListeners();
    }

    return SyncResult(synced, failures);
  }
}
