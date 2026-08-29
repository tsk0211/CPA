import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/purchase.dart';
import '../state/app_scope.dart';

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

  @override
  void initState() {
    super.initState();
    _loadFirstPage();
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
      body: RefreshIndicator(
        onRefresh: _loadFirstPage,
        child: ListView.builder(
          controller: _scrollController,
          itemCount: _items.length + 1,
          itemBuilder: (context, index) {
            if (index < _items.length) {
              final purchase = _items[index];
              return ListTile(
                leading: Text(purchase.projectIcon ?? "📁", style: const TextStyle(fontSize: 22)),
                title: Text(purchase.description),
                subtitle: Text([
                  purchase.projectName ?? '',
                  if (purchase.quantity != null) "${purchase.quantity} ${purchase.unit}",
                  purchase.createdByName ?? '',
                  DateFormat.yMMMEd().add_jm().format(purchase.purchasedAt),
                ].join(" · ")),
                trailing: Text(currency.format(purchase.amount), style: const TextStyle(fontWeight: FontWeight.bold)),
              );
            }
            if (_loading) return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()));
            if (_items.isEmpty) return const Padding(padding: EdgeInsets.all(32), child: Center(child: Text("Nothing logged yet.")));
            return const SizedBox.shrink();
          },
        ),
      ),
    );
  }
}
