import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/project.dart';
import '../state/app_scope.dart';
import '../widgets/add_edit_project_sheet.dart';
import 'activity_screen.dart';
import 'profile_screen.dart';
import 'project_detail_screen.dart';

class ProjectsScreen extends StatefulWidget {
  const ProjectsScreen({super.key});

  @override
  State<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends State<ProjectsScreen> {
  final _scrollController = ScrollController();
  final _searchController = TextEditingController();
  Timer? _debounce;

  final List<Project> _items = [];
  int _page = 1;
  bool _hasMore = true;
  bool _loading = false;
  bool _searching = false;
  String _search = "";

  @override
  void initState() {
    super.initState();
    _loadFirstPage();
    _scrollController.addListener(() {
      if (_scrollController.position.pixels > _scrollController.position.maxScrollExtent - 300) {
        _loadNextPage();
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _loadFirstPage() async {
    setState(() {
      _loading = true;
      _page = 1;
      _hasMore = true;
    });
    final result = await AppScope.of(context).projects.list(page: 1, search: _search);
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
    final result = await AppScope.of(context).projects.list(page: _page + 1, search: _search);
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

  Future<void> _addProject() async {
    final scope = AppScope.of(context);
    final result = await showAddEditProjectSheet(context);
    if (result == null) return;
    await scope.projects.create(result.$1, result.$2);
    if (mounted) _loadFirstPage();
  }

  Future<void> _editProject(Project project) async {
    final scope = AppScope.of(context);
    final result = await showAddEditProjectSheet(context, existing: project);
    if (result == null) return;
    await scope.projects.update(project.id, result.$1, result.$2);
    if (mounted) _loadFirstPage();
  }

  Future<void> _showProjectMenu(Project project) async {
    final scope = AppScope.of(context);
    final role = scope.session.user!.role;
    if (!role.canManageProjects) return;

    final action = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(leading: const Icon(Icons.edit_outlined), title: const Text("Edit"), onTap: () => Navigator.pop(context, "edit")),
            ListTile(
              leading: Icon(Icons.delete_outline, color: Theme.of(context).colorScheme.error),
              title: Text("Delete", style: TextStyle(color: Theme.of(context).colorScheme.error)),
              onTap: () => Navigator.pop(context, "delete"),
            ),
          ],
        ),
      ),
    );

    if (action == "edit") {
      _editProject(project);
    } else if (action == "delete") {
      if (!mounted) return;
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text("Delete ${project.name}?"),
          content: const Text("Its purchase history is kept but hidden from normal views."),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text("Cancel")),
            FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text("Delete")),
          ],
        ),
      );
      if (confirmed == true) {
        await scope.projects.delete(project.id);
        if (mounted) _loadFirstPage();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final role = scope.session.user!.role;
    final currency = NumberFormat.simpleCurrency();

    return Scaffold(
      appBar: AppBar(
        title: _searching
            ? TextField(
                controller: _searchController,
                autofocus: true,
                decoration: const InputDecoration(hintText: "Search projects…", border: InputBorder.none),
                onChanged: _onSearchChanged,
              )
            : const Text("Projects"),
        actions: [
          IconButton(
            icon: Icon(_searching ? Icons.close : Icons.search),
            onPressed: () => setState(() {
              _searching = !_searching;
              if (!_searching) {
                _searchController.clear();
                _search = "";
                _loadFirstPage();
              }
            }),
          ),
          IconButton(
            icon: const Icon(Icons.history),
            tooltip: "Activity",
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ActivityScreen())),
          ),
          IconButton(
            icon: const Icon(Icons.account_circle_outlined),
            tooltip: "Profile",
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ProfileScreen())),
          ),
        ],
      ),
      body: Column(
        children: [
          AnimatedBuilder(
            animation: scope.offlineQueue,
            builder: (context, _) {
              if (!scope.offlineQueue.hasPending) return const SizedBox.shrink();
              return MaterialBanner(
                content: Text("${scope.offlineQueue.pending.length} purchase(s) waiting to sync"),
                leading: const Icon(Icons.cloud_off),
                actions: [
                  TextButton(
                    onPressed: () => scope.offlineQueue.sync(scope.purchases),
                    child: const Text("Sync now"),
                  ),
                ],
              );
            },
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _loadFirstPage,
              child: ListView.builder(
                controller: _scrollController,
                itemCount: _items.length + 1 + (role.canManageProjects ? 1 : 0),
                itemBuilder: (context, index) {
                  if (index < _items.length) {
                    final project = _items[index];
                    return ListTile(
                      leading: Text(project.icon, style: const TextStyle(fontSize: 24)),
                      title: Text(project.name),
                      subtitle: Text(currency.format(project.totalSpent)),
                      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProjectDetailScreen(project: project))),
                      onLongPress: () => _showProjectMenu(project),
                    );
                  }
                  if (index == _items.length) {
                    if (_loading) return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()));
                    if (_items.isEmpty) return const Padding(padding: EdgeInsets.all(32), child: Center(child: Text("No projects yet.")));
                    return const SizedBox.shrink();
                  }
                  return ListTile(
                    leading: const Icon(Icons.add),
                    title: const Text("New project"),
                    onTap: _addProject,
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
