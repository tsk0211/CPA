import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/api_exception.dart';
import '../models/purchase.dart';
import '../state/app_scope.dart';
import '../widgets/breakpoints.dart';
import '../widgets/common/empty_state.dart';
import '../widgets/common/error_text.dart';
import '../widgets/common/skeleton.dart';
import '../widgets/detail_row.dart';
import '../widgets/responsive_center.dart';
import '../widgets/status_badge.dart';

String _messageFor(Object error) {
  if (error is ApiException) return error.message;
  if (error is NetworkUnavailableException) return networkUnavailableMessage;
  return "Something went wrong. Please try again.";
}

class ActivityScreen extends StatefulWidget {
  const ActivityScreen({super.key});

  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  final _scrollController = ScrollController();
  final List<Purchase> _items = [];
  int _page = 1;
  bool _hasMore = true;
  bool _loading = false;
  bool _bootstrapped = false;
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // AppScope.of(context) isn't valid in initState (it's an InheritedWidget
    // lookup) — didChangeDependencies is the correct hook, guarded to fire
    // only once.
    if (!_bootstrapped) {
      _bootstrapped = true;
      _loadFirstPage();
    }
  }

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(() {
      if (_scrollController.position.pixels > _scrollController.position.maxScrollExtent - 300) _loadNextPage();
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadFirstPage() async {
    setState(() {
      _loading = true;
      _error = null;
      _page = 1;
      _hasMore = true;
    });
    try {
      final result = await AppScope.of(context).purchases.recent(page: 1);
      if (!mounted) return;
      setState(() {
        _items
          ..clear()
          ..addAll(result.items);
        _hasMore = result.hasMore;
      });
    } catch (e) {
      if (mounted) setState(() => _error = _messageFor(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadNextPage() async {
    if (_loading || !_hasMore) return;
    setState(() => _loading = true);
    try {
      final result = await AppScope.of(context).purchases.recent(page: _page + 1);
      if (!mounted) return;
      setState(() {
        _items.addAll(result.items);
        _page += 1;
        _hasMore = result.hasMore;
      });
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_messageFor(e))));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.simpleCurrency();

    return Scaffold(
      appBar: AppBar(title: const Text("Activity")),
      body: ResponsiveCenter(
        maxWidth: isDesktop(context) ? 1000 : 720,
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: _buildBody(context, currency),
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context, NumberFormat currency) {
    if (_loading && _items.isEmpty && _error == null) {
      return const SkeletonList(key: ValueKey('loading'));
    }
    if (_error != null && _items.isEmpty) {
      return EmptyState(
        key: const ValueKey('error'),
        icon: Icons.error_outline,
        title: "Couldn't load activity",
        subtitle: _error,
        action: FilledButton(onPressed: _loadFirstPage, child: const Text("Retry")),
      );
    }
    if (_items.isEmpty) {
      return const EmptyState(key: ValueKey('empty'), icon: Icons.history_toggle_off, title: "Nothing logged yet");
    }
    return KeyedSubtree(
      key: const ValueKey('content'),
      child: isDesktop(context) ? _buildDesktopTable(context, currency) : _buildList(context, currency),
    );
  }

  Widget _buildList(BuildContext context, NumberFormat currency) {
    return RefreshIndicator(
      onRefresh: _loadFirstPage,
      child: ListView.builder(
        controller: _scrollController,
        itemCount: _items.length + 1,
        itemBuilder: (context, index) {
          if (index < _items.length) {
            final purchase = _items[index];
            return ListTile(
              leading: Text(purchase.projectIcon ?? "📁", style: const TextStyle(fontSize: 22)),
              title: Row(
                children: [
                  Flexible(child: Text(purchase.description, maxLines: 1, overflow: TextOverflow.ellipsis)),
                  if (purchase.status != PurchaseStatus.approved) ...[
                    const SizedBox(width: 6),
                    StatusBadge(status: purchase.status),
                  ],
                ],
              ),
              subtitle: Text(
                [
                  purchase.projectName ?? '',
                  if (purchase.quantity != null) "${purchase.quantity} ${purchase.unit}",
                  purchase.createdByName ?? '',
                  DateFormat.yMMMEd().add_jm().format(purchase.purchasedAt),
                ].join(" · "),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: Text(currency.format(purchase.amount), style: const TextStyle(fontWeight: FontWeight.bold)),
              onTap: () => _showDetails(context, purchase, currency),
            );
          }
          if (_loading) return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()));
          return const SizedBox.shrink();
        },
      ),
    );
  }

  // Read-only feed with real width to spare on desktop — a sortable table
  // scans faster than a scrolling list once there's real volume.
  Widget _buildDesktopTable(BuildContext context, NumberFormat currency) {
    final dateFormat = DateFormat.yMMMd().add_jm();
    return SingleChildScrollView(
      controller: _scrollController,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Card(
            clipBehavior: Clip.antiAlias,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                columns: const [
                  DataColumn(label: Text("Project")),
                  DataColumn(label: Text("Description")),
                  DataColumn(label: Text("Status")),
                  DataColumn(label: Text("Amount"), numeric: true),
                  DataColumn(label: Text("Logged by")),
                  DataColumn(label: Text("Date")),
                ],
                rows: [
                  for (final purchase in _items)
                    DataRow(
                      onSelectChanged: (_) => _showDetails(context, purchase, currency),
                      cells: [
                        DataCell(Row(mainAxisSize: MainAxisSize.min, children: [
                          Text(purchase.projectIcon ?? "📁"),
                          const SizedBox(width: 6),
                          Text(purchase.projectName ?? "—"),
                        ])),
                        DataCell(SizedBox(width: 260, child: Text(purchase.description, overflow: TextOverflow.ellipsis))),
                        DataCell(StatusBadge(status: purchase.status)),
                        DataCell(Text(currency.format(purchase.amount))),
                        DataCell(Text(purchase.createdByName ?? "—")),
                        DataCell(Text(dateFormat.format(purchase.purchasedAt))),
                      ],
                    ),
                ],
              ),
            ),
          ),
          if (_loading) const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator())),
          if (_hasMore && !_loading) Center(child: TextButton(onPressed: _loadNextPage, child: const Text("Load more"))),
        ],
      ),
    );
  }

  // The list row truncates to one line to stay scannable — this is where
  // the full record (vendor/category/notes included) actually lives.
  void _showDetails(BuildContext context, Purchase purchase, NumberFormat currency) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(purchase.description),
        content: SizedBox(
          width: double.maxFinite,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                DetailRow(label: "Amount", value: currency.format(purchase.amount)),
                if (purchase.projectName != null) DetailRow(label: "Project", value: purchase.projectName!),
                if (purchase.quantity != null) DetailRow(label: "Quantity", value: "${purchase.quantity} ${purchase.unit}"),
                if (purchase.vendor != null) DetailRow(label: "Vendor", value: purchase.vendor!),
                if (purchase.category != null) DetailRow(label: "Category", value: purchase.category!),
                if (purchase.notes != null) DetailRow(label: "Notes", value: purchase.notes!),
                if (purchase.createdByName != null) DetailRow(label: "Logged by", value: purchase.createdByName!),
                DetailRow(label: "Purchased at", value: DateFormat.yMMMEd().add_jm().format(purchase.purchasedAt)),
                if (purchase.editedAt != null) DetailRow(label: "Edited at", value: DateFormat.yMMMEd().add_jm().format(purchase.editedAt!)),
              ],
            ),
          ),
        ),
        actions: [TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text("Close"))],
      ),
    );
  }
}
