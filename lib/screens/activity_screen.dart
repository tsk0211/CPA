import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/purchase.dart';
import '../state/app_scope.dart';
import '../widgets/detail_row.dart';
import '../widgets/responsive_center.dart';

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
      _page = 1;
      _hasMore = true;
    });
    final result = await AppScope.of(context).purchases.recent(page: 1);
    if (!mounted) return;
    setState(() {
      _items
        ..clear()
        ..addAll(result.items);
      _hasMore = result.hasMore;
      _loading = false;
    });
  }

  Future<void> _loadNextPage() async {
    if (_loading || !_hasMore) return;
    setState(() => _loading = true);
    final result = await AppScope.of(context).purchases.recent(page: _page + 1);
    if (!mounted) return;
    setState(() {
      _items.addAll(result.items);
      _page += 1;
      _hasMore = result.hasMore;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.simpleCurrency();

    return Scaffold(
      appBar: AppBar(title: const Text("Activity")),
      body: ResponsiveCenter(
        child: RefreshIndicator(
          onRefresh: _loadFirstPage,
          child: ListView.builder(
            controller: _scrollController,
            itemCount: _items.length + 1,
            itemBuilder: (context, index) {
              if (index < _items.length) {
                final purchase = _items[index];
                return ListTile(
                  leading: Text(purchase.projectIcon ?? "📁", style: const TextStyle(fontSize: 22)),
                  title: Text(purchase.description, maxLines: 1, overflow: TextOverflow.ellipsis),
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
              if (_items.isEmpty) return const Padding(padding: EdgeInsets.all(32), child: Center(child: Text("Nothing logged yet.")));
              return const SizedBox.shrink();
            },
          ),
        ),
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
