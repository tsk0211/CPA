import 'package:flutter/widgets.dart';

/// Generalizes the per-row "busy id" set already used in `review_screen.dart`
/// to guard against double-submitting a row's async action (approve/reject,
/// deactivate, role-change) while a previous call for that same id is still
/// in flight. Not meant for single-submit forms — a local `bool _submitting`
/// is simpler and idiomatic there; this is specifically for "a list of rows,
/// each with its own async action" screens.
mixin BusyGuard<T extends StatefulWidget> on State<T> {
  final Set<String> _busyIds = {};

  bool isBusy(String id) => _busyIds.contains(id);

  Future<void> runBusy(String id, Future<void> Function() action) async {
    if (_busyIds.contains(id)) return;
    setState(() => _busyIds.add(id));
    try {
      await action();
    } finally {
      if (mounted) setState(() => _busyIds.remove(id));
    }
  }
}
