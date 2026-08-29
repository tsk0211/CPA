import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../db.dart';
import '../models.dart';
import '../widgets/add_purchase_sheet.dart';

class TodayScreen extends StatefulWidget {
  const TodayScreen({super.key});

  @override
  State<TodayScreen> createState() => _TodayScreenState();
}

class _TodayScreenState extends State<TodayScreen> {
  late Future<_TodayData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_TodayData> _load() async {
    final projects = await AppDatabase.instance.listProjects();
    final purchases = await AppDatabase.instance.purchasesOnDay(DateTime.now());
    final byId = {for (final p in projects) p.id: p};
    return _TodayData(projects: projects, purchases: purchases, projectById: byId);
  }

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.simpleCurrency();
    final today = DateFormat.yMMMEd().format(DateTime.now());

    return Scaffold(
      appBar: AppBar(title: const Text('Today')),
      body: FutureBuilder<_TodayData>(
        future: _future,
        builder: (context, snapshot) {
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          final data = snapshot.data!;
          final total = data.purchases.fold<double>(0, (sum, p) => sum + p.amount);

          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(today, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(
                  currency.format(total),
                  style: Theme.of(context).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.bold),
                ),
                const Text('total spent today across all projects'),
                const SizedBox(height: 24),
                if (data.purchases.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: Center(child: Text('No purchases logged today yet.')),
                  )
                else
                  ...data.purchases.map((purchase) {
                    final project = data.projectById[purchase.projectId];
                    return Card(
                      child: ListTile(
                        title: Text(purchase.description),
                        subtitle: Text('${project?.name ?? 'Unknown project'} · ${DateFormat.jm().format(purchase.purchasedAt)}'),
                        trailing: Text(
                          currency.format(purchase.amount),
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                    );
                  }),
              ],
            ),
          );
        },
      ),
      floatingActionButton: FutureBuilder<_TodayData>(
        future: _future,
        builder: (context, snapshot) {
          final projects = snapshot.data?.projects ?? const <Project>[];
          return FloatingActionButton.extended(
            icon: const Icon(Icons.add),
            label: const Text('Purchase'),
            onPressed: projects.isEmpty
                ? () => ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Create a project first, from the Projects tab.')),
                    )
                : () async {
                    final added = await showAddPurchaseSheet(context, projects: projects);
                    if (added == true) _refresh();
                  },
          );
        },
      ),
    );
  }
}

class _TodayData {
  final List<Project> projects;
  final List<Purchase> purchases;
  final Map<int?, Project> projectById;

  _TodayData({required this.projects, required this.purchases, required this.projectById});
}
