import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/api_exception.dart';
import '../models/purchase.dart';
import '../state/app_scope.dart';
import '../widgets/breakpoints.dart';
import '../widgets/reject_reason_dialog.dart';
import '../widgets/responsive_center.dart';

/// The desktop admin review queue: every pending purchase across all
/// projects, oldest first, with an approve/reject action on each. This is
/// the screen the "review and manage" half of the app is actually built
/// around — Members log purchases from the mobile app, Owner/Admin clear
/// the queue from here.
class ReviewScreen extends StatefulWidget {
  final VoidCallback onReviewed;
  const ReviewScreen({super.key, required this.onReviewed});

  @override
  State<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends State<ReviewScreen> {
  final List<Purchase> _items = [];
  int _page = 1;
  bool _hasMore = true;
  bool _loading = false;
  bool _bootstrapped = false;
  String? _error;
  // Per-row in-flight guard so a double-tap on Approve/Reject can't fire the
  // request twice while the first one is still on the wire.
  final Set<String> _busyIds = {};

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_bootstrapped) {
      _bootstrapped = true;
      _load();
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await AppScope.of(context).purchases.pending(page: 1, limit: 50);
      if (!mounted) return;
      setState(() {
        _items
          ..clear()
          ..addAll(result.items);
        _page = 1;
        _hasMore = result.hasMore;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } on NetworkUnavailableException {
      if (mounted) setState(() => _error = "Can't reach the server. The review queue needs a live connection.");
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    if (_loading || !_hasMore) return;
    setState(() => _loading = true);
    final result = await AppScope.of(context).purchases.pending(page: _page + 1, limit: 50);
    if (!mounted) return;
    setState(() {
      _items.addAll(result.items);
      _page += 1;
      _hasMore = result.hasMore;
      _loading = false;
    });
  }

  Future<void> _approve(Purchase purchase) async {
    setState(() => _busyIds.add(purchase.id));
    try {
      await AppScope.of(context).purchases.approve(purchase.id);
      if (!mounted) return;
      setState(() => _items.removeWhere((p) => p.id == purchase.id));
      widget.onReviewed();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Couldn't approve: ${e.message}")));
    } finally {
      if (mounted) setState(() => _busyIds.remove(purchase.id));
    }
  }

  Future<void> _reject(Purchase purchase) async {
    final reason = await askRejectionReason(context, purchase.description);
    if (reason == null || !mounted) return;
    setState(() => _busyIds.add(purchase.id));
    try {
      await AppScope.of(context).purchases.reject(purchase.id, reason);
      if (!mounted) return;
      setState(() => _items.removeWhere((p) => p.id == purchase.id));
      widget.onReviewed();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Couldn't reject: ${e.message}")));
    } finally {
      if (mounted) setState(() => _busyIds.remove(purchase.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Review"),
        actions: [IconButton(icon: const Icon(Icons.refresh), tooltip: "Refresh", onPressed: _load)],
      ),
      body: ResponsiveCenter(
        maxWidth: isDesktop(context) ? 1100 : 720,
        child: _buildBody(context),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_loading && _items.isEmpty) return const Center(child: CircularProgressIndicator());
    if (_error != null) return Center(child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)));
    if (_items.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text("Nothing waiting for review. Purchases logged by Members will show up here.", textAlign: TextAlign.center),
        ),
      );
    }
    return isDesktop(context) ? _ReviewTable(items: _items, busyIds: _busyIds, onApprove: _approve, onReject: _reject) : _buildList(context);
  }

  Widget _buildList(BuildContext context) {
    final currency = NumberFormat.simpleCurrency();
    final dateFormat = DateFormat.yMMMd().add_jm();
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        itemCount: _items.length + 1,
        itemBuilder: (context, index) {
          if (index >= _items.length) {
            if (!_hasMore) return const SizedBox.shrink();
            return Center(
              child: TextButton(
                onPressed: _loading ? null : _loadMore,
                child: _loading ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Text("Load more"),
              ),
            );
          }
          final purchase = _items[index];
          final busy = _busyIds.contains(purchase.id);
          return Card(
            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (purchase.projectIcon != null) Padding(padding: const EdgeInsets.only(right: 8), child: Text(purchase.projectIcon!)),
                      Expanded(child: Text(purchase.description, style: Theme.of(context).textTheme.titleSmall)),
                      Text(currency.format(purchase.amount), style: const TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    [if (purchase.projectName != null) purchase.projectName!, purchase.createdByName ?? "unknown", dateFormat.format(purchase.purchasedAt)].join(" · "),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(onPressed: busy ? null : () => _reject(purchase), child: const Text("Reject")),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: busy ? null : () => _approve(purchase),
                        child: busy ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Text("Approve"),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _ReviewTable extends StatelessWidget {
  final List<Purchase> items;
  final Set<String> busyIds;
  final void Function(Purchase) onApprove;
  final void Function(Purchase) onReject;
  const _ReviewTable({required this.items, required this.busyIds, required this.onApprove, required this.onReject});

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.simpleCurrency();
    final dateFormat = DateFormat.yMMMd().add_jm();
    return SingleChildScrollView(
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          columns: const [
            DataColumn(label: Text("Project")),
            DataColumn(label: Text("Description")),
            DataColumn(label: Text("Amount"), numeric: true),
            DataColumn(label: Text("Submitted by")),
            DataColumn(label: Text("Date")),
            DataColumn(label: Text("Actions")),
          ],
          rows: [
            for (final purchase in items)
              DataRow(
                cells: [
                  DataCell(Row(mainAxisSize: MainAxisSize.min, children: [
                    if (purchase.projectIcon != null) Padding(padding: const EdgeInsets.only(right: 6), child: Text(purchase.projectIcon!)),
                    Text(purchase.projectName ?? "—"),
                  ])),
                  DataCell(SizedBox(width: 260, child: Text(purchase.description, overflow: TextOverflow.ellipsis))),
                  DataCell(Text(currency.format(purchase.amount))),
                  DataCell(Text(purchase.createdByName ?? "unknown")),
                  DataCell(Text(dateFormat.format(purchase.purchasedAt))),
                  DataCell(
                    busyIds.contains(purchase.id)
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.close),
                                tooltip: "Reject",
                                color: Theme.of(context).colorScheme.error,
                                onPressed: () => onReject(purchase),
                              ),
                              IconButton(icon: const Icon(Icons.check), tooltip: "Approve", onPressed: () => onApprove(purchase)),
                            ],
                          ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
