import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../db.dart';
import '../models.dart';
import '../widgets/add_purchase_sheet.dart';

class ProjectDetailScreen extends StatefulWidget {
  final Project project;

  const ProjectDetailScreen({super.key, required this.project});

  @override
  State<ProjectDetailScreen> createState() => _ProjectDetailScreenState();
}

class _ProjectDetailScreenState extends State<ProjectDetailScreen> {
  late Future<List<Purchase>> _future;

  @override
  void initState() {
    super.initState();
    _future = AppDatabase.instance.purchasesForProject(widget.project.id!);
  }

  void _refresh() => setState(() => _future = AppDatabase.instance.purchasesForProject(widget.project.id!));

  Future<void> _deleteProject() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Delete ${widget.project.name}?'),
        content: const Text('This removes the project and all of its purchase records.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete')),
        ],
      ),
    );
    if (confirmed == true) {
      await AppDatabase.instance.deleteProject(widget.project.id!);
      if (mounted) Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.simpleCurrency();

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.project.name),
        actions: [
          IconButton(onPressed: _deleteProject, icon: const Icon(Icons.delete_outline)),
        ],
      ),
      body: FutureBuilder<List<Purchase>>(
        future: _future,
        builder: (context, snapshot) {
          if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
          final purchases = snapshot.data!;
          final total = purchases.fold<double>(0, (sum, p) => sum + p.amount);

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total spent'),
                    Text(
                      currency.format(total),
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: purchases.isEmpty
                    ? const Center(child: Text('No purchases logged for this project yet.'))
                    : ListView.builder(
                        itemCount: purchases.length,
                        itemBuilder: (context, i) {
                          final purchase = purchases[i];
                          return Dismissible(
                            key: ValueKey(purchase.id),
                            direction: DismissDirection.endToStart,
                            background: Container(
                              color: Theme.of(context).colorScheme.errorContainer,
                              alignment: Alignment.centerRight,
                              padding: const EdgeInsets.symmetric(horizontal: 20),
                              child: const Icon(Icons.delete_outline),
                            ),
                            onDismissed: (_) async {
                              await AppDatabase.instance.deletePurchase(purchase.id!);
                            },
                            child: ListTile(
                              title: Text(purchase.description),
                              subtitle: Text(DateFormat.yMMMEd().add_jm().format(purchase.purchasedAt)),
                              trailing: Text(
                                currency.format(purchase.amount),
                                style: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('Purchase'),
        onPressed: () async {
          final added = await showAddPurchaseSheet(context, projects: [widget.project], fixedProject: widget.project);
          if (added == true) _refresh();
        },
      ),
    );
  }
}
