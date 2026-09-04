import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/api_exception.dart';
import '../models/audit_entry.dart';
import '../models/project.dart';
import '../models/purchase.dart';
import '../state/app_scope.dart';
import '../widgets/add_edit_project_sheet.dart';
import '../widgets/add_edit_purchase_sheet.dart';
import '../widgets/audit_entry_tile.dart';
import '../widgets/responsive_center.dart';

class ProjectDetailScreen extends StatefulWidget {
  final Project project;
  const ProjectDetailScreen({super.key, required this.project});

  @override
  State<ProjectDetailScreen> createState() => _ProjectDetailScreenState();
}

class _ProjectDetailScreenState extends State<ProjectDetailScreen> with SingleTickerProviderStateMixin {
  late Project _project = widget.project;
  TabController? _tabController;
  final _purchasesTabKey = GlobalKey<_PurchasesTabState>();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // AppScope.of(context) isn't valid in initState (it's an InheritedWidget
    // lookup) — didChangeDependencies is the correct hook, guarded so the
    // controller is only created once.
    if (_tabController == null) {
      final scope = AppScope.of(context);
      final showActivityTab = scope.session.user!.role.canSeeActivityLog;
      if (showActivityTab) _tabController = TabController(length: 2, vsync: this);
    }
  }

  @override
  void dispose() {
    _tabController?.dispose();
    super.dispose();
  }

  Future<void> _editProject() async {
    final scope = AppScope.of(context);
    final result = await showAddEditProjectSheet(context, existing: _project);
    if (result == null) return;
    await scope.projects.update(_project.id, result.$1, result.$2);
    await _refreshProject();
  }

  // Re-fetches the project so "Total spent" reflects the current server
  // total — the project passed into this screen is a snapshot from the
  // list, and purchase creates/edits/deletes never update it in place.
  //
  // Failures here are swallowed into a snackbar rather than rethrown: the
  // purchase/project change that triggered this refresh already succeeded,
  // so a stale total is a cosmetic problem, not one worth surfacing as a
  // hard error over.
  Future<void> _refreshProject() async {
    try {
      final updated = await AppScope.of(context).projects.get(_project.id);
      if (!mounted) return;
      setState(() => _project = updated);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Couldn't refresh totals: ${e.message}")));
    } on NetworkUnavailableException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Couldn't refresh totals — no connection.")));
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = AppScope.of(context).session.user!.role;
    final currency = NumberFormat.simpleCurrency();

    return Scaffold(
      appBar: AppBar(
        title: GestureDetector(
          onTap: role.canManageProjects ? _editProject : null,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Hero(tag: 'project-icon-${_project.id}', child: Text(_project.icon)),
              const SizedBox(width: 8),
              Flexible(child: Text(_project.name, maxLines: 1, overflow: TextOverflow.ellipsis)),
              if (role.canManageProjects) ...[
                const SizedBox(width: 6),
                const Icon(Icons.edit, size: 16),
              ],
            ],
          ),
        ),
        bottom: _tabController != null
            ? TabBar(controller: _tabController, tabs: const [Tab(text: "Purchases"), Tab(text: "Activity")])
            : null,
      ),
      body: ResponsiveCenter(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text("Total spent"),
                  // Flexible + FittedBox: a large total (six figures isn't
                  // unrealistic for a real project) shrinks to fit instead
                  // of overflowing off the edge of narrow phones — this Row
                  // has no other flex child to absorb the extra width.
                  Flexible(
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 200),
                      child: FittedBox(
                        key: ValueKey(_project.totalSpent),
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerRight,
                        child: Text(
                          currency.format(_project.totalSpent),
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: _tabController != null
                  ? TabBarView(
                      controller: _tabController,
                      children: [
                        _PurchasesTab(key: _purchasesTabKey, project: _project, onChanged: _refreshProject),
                        _ActivityTab(projectId: _project.id),
                      ],
                    )
                  : _PurchasesTab(key: _purchasesTabKey, project: _project, onChanged: _refreshProject),
            ),
          ],
        ),
      ),
      floatingActionButton: role.canAddPurchases
          ? FloatingActionButton.extended(
              icon: const Icon(Icons.add),
              label: const Text("Purchase"),
              onPressed: () async {
                final changed = await showAddEditPurchaseSheet(context, projectId: _project.id, projectName: _project.name);
                if (changed == true) {
                  await _refreshProject();
                  _purchasesTabKey.currentState?.refresh();
                }
              },
            )
          : null,
    );
  }
}

class _PurchasesTab extends StatefulWidget {
  final Project project;
  final VoidCallback onChanged;
  const _PurchasesTab({super.key, required this.project, required this.onChanged});

  @override
  State<_PurchasesTab> createState() => _PurchasesTabState();
}

class _PurchasesTabState extends State<_PurchasesTab> {
  final _scrollController = ScrollController();
  final _searchController = TextEditingController();
  Timer? _debounce;

  final List<Purchase> _items = [];
  int _page = 1;
  bool _hasMore = true;
  bool _loading = false;
  String _search = "";
  bool _bootstrapped = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
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
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  // Exposed so the parent screen's "add purchase" FAB — which lives outside
  // this tab and has no other way to reach its list state — can reload the
  // list after a create, the same way _editPurchase/_deletePurchase already
  // do for themselves below.
  void refresh() => _loadFirstPage();

  Future<void> _loadFirstPage() async {
    setState(() {
      _loading = true;
      _page = 1;
      _hasMore = true;
    });
    final result = await AppScope.of(context).purchases.forProject(widget.project.id, page: 1, search: _search);
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
    final result = await AppScope.of(context).purchases.forProject(widget.project.id, page: _page + 1, search: _search);
    if (!mounted) return;
    setState(() {
      _items.addAll(result.items);
      _page += 1;
      _hasMore = result.hasMore;
      _loading = false;
    });
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      _search = value;
      _loadFirstPage();
    });
  }

  Future<void> _editPurchase(Purchase purchase) async {
    final changed = await showAddEditPurchaseSheet(context, projectId: widget.project.id, projectName: widget.project.name, existing: purchase);
    if (changed == true) {
      _loadFirstPage();
      widget.onChanged();
    }
  }

  Future<void> _deletePurchase(Purchase purchase) async {
    await AppScope.of(context).purchases.delete(purchase.id);
    _loadFirstPage();
    widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final role = scope.session.user!.role;
    final currency = NumberFormat.simpleCurrency();
    final pendingForProject = scope.offlineQueue.pending.where((p) => p.projectId == widget.project.id).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: TextField(
            controller: _searchController,
            decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: "Search purchases…", isDense: true),
            onChanged: _onSearchChanged,
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _loadFirstPage,
            child: ListView.builder(
              controller: _scrollController,
              itemCount: pendingForProject.length + _items.length + 1,
              itemBuilder: (context, index) {
                if (index < pendingForProject.length) {
                  final pending = pendingForProject[index];
                  return ListTile(
                    leading: const Icon(Icons.cloud_upload_outlined),
                    title: Text(pending.description, maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: const Text("Pending sync"),
                    trailing: Text(currency.format(pending.amount)),
                  );
                }
                final itemIndex = index - pendingForProject.length;
                if (itemIndex < _items.length) {
                  final purchase = _items[itemIndex];
                  final tile = ListTile(
                    title: Text(purchase.description, maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(
                      [
                        if (purchase.quantity != null) "${purchase.quantity} ${purchase.unit}",
                        if (purchase.vendor != null) purchase.vendor!,
                        DateFormat.yMMMEd().add_jm().format(purchase.purchasedAt),
                        if (purchase.editedAt != null) "edited",
                      ].join(" · "),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: Text(currency.format(purchase.amount), style: const TextStyle(fontWeight: FontWeight.bold)),
                  );
                  if (!role.canEditPurchases) return tile;
                  return Dismissible(
                    key: ValueKey(purchase.id),
                    direction: DismissDirection.endToStart,
                    confirmDismiss: (_) async {
                      _deletePurchase(purchase);
                      return false; // we refresh the list ourselves
                    },
                    background: Container(
                      color: Theme.of(context).colorScheme.errorContainer,
                      alignment: Alignment.centerRight,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: const Icon(Icons.delete_outline),
                    ),
                    child: InkWell(onTap: () => _editPurchase(purchase), child: tile),
                  );
                }
                if (_loading) return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()));
                if (_items.isEmpty && pendingForProject.isEmpty) {
                  return const Padding(padding: EdgeInsets.all(32), child: Center(child: Text("No purchases logged yet.")));
                }
                return const SizedBox.shrink();
              },
            ),
          ),
        ),
      ],
    );
  }
}

class _ActivityTab extends StatefulWidget {
  final String projectId;
  const _ActivityTab({required this.projectId});

  @override
  State<_ActivityTab> createState() => _ActivityTabState();
}

class _ActivityTabState extends State<_ActivityTab> {
  late Future<void> _future;
  final List<AuditEntry> _items = [];
  int _page = 1;
  bool _hasMore = true;
  bool _bootstrapped = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // AppScope.of(context) isn't valid in initState — didChangeDependencies
    // always runs before the first build, so `_future` is still assigned in
    // time for the FutureBuilder below.
    if (!_bootstrapped) {
      _bootstrapped = true;
      _future = _load();
    }
  }

  Future<void> _load() async {
    final result = await AppScope.of(context).auditLog.list(projectId: widget.projectId, page: 1);
    _items
      ..clear()
      ..addAll(result.items);
    _hasMore = result.hasMore;
    _page = 1;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
        if (_items.isEmpty) return const Center(child: Text("No activity recorded for this project yet."));
        return RefreshIndicator(
          onRefresh: () async => setState(() => _future = _load()),
          child: ListView.builder(
            itemCount: _items.length + (_hasMore ? 1 : 0),
            itemBuilder: (context, index) {
              if (index >= _items.length) {
                return TextButton(
                  onPressed: () async {
                    final result = await AppScope.of(context).auditLog.list(projectId: widget.projectId, page: _page + 1);
                    setState(() {
                      _items.addAll(result.items);
                      _page += 1;
                      _hasMore = result.hasMore;
                    });
                  },
                  child: const Text("Load more"),
                );
              }
              return AuditEntryTile(entry: _items[index]);
            },
          ),
        );
      },
    );
  }
}
