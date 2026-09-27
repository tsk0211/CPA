import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/api_exception.dart';
import '../models/project.dart';
import '../models/role.dart';
import '../state/app_scope.dart';
import '../theme.dart';
import '../widgets/add_edit_project_sheet.dart';
import '../widgets/breakpoints.dart';
import '../widgets/common/confirm_dialog.dart';
import '../widgets/common/empty_state.dart';
import '../widgets/common/error_text.dart';
import '../widgets/common/icon_badge.dart';
import '../widgets/common/skeleton.dart';
import '../widgets/responsive_center.dart';
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
  bool _mutating = false;
  bool _searching = false;
  String _search = "";
  bool _bootstrapped = false;
  String? _error;

  // Desktop DataTable column sort — column 1 is Name, column 2 is Total
  // spent (see _buildDesktopTable). Client-side only: the current page's
  // items are re-sorted in place rather than round-tripping the server,
  // since a project list page is small enough for that to be instant.
  int _sortColumn = 1;
  bool _sortAscending = true;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // AppScope.of(context) (an InheritedWidget lookup) isn't valid in
    // initState — didChangeDependencies is the correct lifecycle hook for
    // "load data that depends on inherited context," guarded so it only
    // fires once rather than on every dependency change.
    if (!_bootstrapped) {
      _bootstrapped = true;
      _loadFirstPage();
    }
  }

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(() {
      if (_scrollController.position.pixels >
          _scrollController.position.maxScrollExtent - 300) {
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

  String _messageFor(Object error) {
    if (error is ApiException) return error.message;
    if (error is NetworkUnavailableException) return networkUnavailableMessage;
    return "Something went wrong. Please try again.";
  }

  void _showErrorSnackBar(Object error) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(_messageFor(error))));
  }

  void _showSuccessSnackBar(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _loadFirstPage() async {
    final scope = AppScope.of(context);
    final isInitialUnfilteredLoad = _search.isEmpty && _items.isEmpty;

    setState(() {
      _loading = true;
      _error = null;
      _page = 1;
      _hasMore = true;
    });

    // Paint something real-looking immediately from last session's cache,
    // rather than a skeleton, while the live request is still in flight —
    // only for the very first unfiltered load, never for a search or a
    // manual refresh where showing stale data instead of a spinner would be
    // actively misleading.
    if (isInitialUnfilteredLoad) {
      final cached = await scope.cache.loadProjects();
      if (cached.isNotEmpty && mounted && _items.isEmpty) {
        setState(() => _items.addAll(cached));
      }
    }

    try {
      final result = await scope.projects.list(page: 1, search: _search);
      if (!mounted) return;
      setState(() {
        _items
          ..clear()
          ..addAll(result.items);
        _hasMore = result.hasMore;
      });
      if (isInitialUnfilteredLoad) {
        unawaited(scope.cache.saveProjects(result.items));
      }
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
      final result = await AppScope.of(context).projects
          .list(page: _page + 1, search: _search);
      if (!mounted) return;
      setState(() {
        _items.addAll(result.items);
        _page += 1;
        _hasMore = result.hasMore;
      });
    } catch (e) {
      _showErrorSnackBar(e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
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
    if (result == null || _mutating) return;
    setState(() => _mutating = true);
    try {
      await scope.projects.create(result.$1, result.$2);
      _showSuccessSnackBar("Project created.");
      if (mounted) await _loadFirstPage();
    } catch (e) {
      _showErrorSnackBar(e);
    } finally {
      if (mounted) setState(() => _mutating = false);
    }
  }

  Future<void> _editProject(Project project) async {
    final scope = AppScope.of(context);
    final result = await showAddEditProjectSheet(context, existing: project);
    if (result == null || _mutating) return;
    setState(() => _mutating = true);
    try {
      await scope.projects.update(
        project.id,
        result.$1,
        result.$2,
        autoApproveThreshold: result.$3,
      );
      _showSuccessSnackBar("Project updated.");
      if (mounted) await _loadFirstPage();
    } catch (e) {
      _showErrorSnackBar(e);
    } finally {
      if (mounted) setState(() => _mutating = false);
    }
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
            ListTile(
              leading: const Icon(Icons.edit_outlined),
              title: const Text("Edit"),
              onTap: () => Navigator.pop(context, "edit"),
            ),
            ListTile(
              leading: Icon(
                Icons.delete_outline,
                color: Theme.of(context).colorScheme.error,
              ),
              title: Text(
                "Delete",
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
              onTap: () => Navigator.pop(context, "delete"),
            ),
          ],
        ),
      ),
    );

    if (action == "edit") {
      _editProject(project);
    } else if (action == "delete") {
      if (!mounted || _mutating) return;
      final confirmed = await confirmAction(
        context,
        title: "Delete ${project.name}?",
        message: "Its purchase history is kept but hidden from normal views.",
        confirmLabel: "Delete",
        tone: ConfirmDialogTone.destructive,
      );
      if (!confirmed) return;
      setState(() => _mutating = true);
      try {
        await scope.projects.delete(project.id);
        _showSuccessSnackBar("Project deleted.");
        if (mounted) await _loadFirstPage();
      } catch (e) {
        _showErrorSnackBar(e);
      } finally {
        if (mounted) setState(() => _mutating = false);
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
                decoration: const InputDecoration(
                  hintText: "Search projects…",
                  border: InputBorder.none,
                ),
                onChanged: _onSearchChanged,
              )
            : const Text("Projects"),
        actions: [
          IconButton(
            icon: Icon(_searching ? Icons.close : Icons.search),
            tooltip: _searching ? "Close search" : "Search",
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
            onPressed: () => Navigator.of(
              context,
            ).push(MaterialPageRoute(builder: (_) => const ActivityScreen())),
          ),
          IconButton(
            icon: const Icon(Icons.account_circle_outlined),
            tooltip: "Profile",
            onPressed: () => Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => const ProfileScreen())),
          ),
        ],
      ),
      body: ResponsiveCenter(
        maxWidth: isDesktop(context) ? 1100 : 720,
        // stretch: without it, this Column's default center alignment gives
        // the Expanded body a loose width constraint, so the desktop
        // table's Card (which shrinks to its own content width) ends up
        // centered on the page instead of left-aligned — see team_screen.dart,
        // where a screenshot caught this exact bug.
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AnimatedBuilder(
              animation: scope.offlineQueue,
              builder: (context, _) {
                if (!scope.offlineQueue.hasPending) {
                  return const SizedBox.shrink();
                }
                return MaterialBanner(
                  content: Text(
                    "${scope.offlineQueue.pending.length} purchase(s) waiting to sync",
                  ),
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
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: _buildBody(context, currency, role),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context, NumberFormat currency, Role role) {
    if (_loading && _items.isEmpty && _error == null) {
      return const SkeletonList(key: ValueKey('loading'));
    }
    if (_error != null && _items.isEmpty) {
      return EmptyState(
        key: const ValueKey('error'),
        icon: Icons.error_outline,
        title: "Couldn't load projects",
        subtitle: _error,
        action: FilledButton(
          onPressed: _loadFirstPage,
          child: const Text("Retry"),
        ),
      );
    }
    return KeyedSubtree(
      key: const ValueKey('content'),
      child: isDesktop(context)
          ? _buildDesktopTable(context, currency, role)
          : _buildList(context, currency, role),
    );
  }

  Widget _buildList(BuildContext context, NumberFormat currency, Role role) {
    if (_items.isEmpty) {
      return EmptyState(
        icon: Icons.folder_off_outlined,
        title: "No projects yet",
        subtitle: role.canManageProjects
            ? "Create your first project to start tracking purchases."
            : "Ask an admin to add a project.",
        action: role.canManageProjects
            ? FilledButton.icon(
                onPressed: _addProject,
                icon: const Icon(Icons.add),
                label: const Text("New project"),
              )
            : null,
      );
    }
    return RefreshIndicator(
      onRefresh: _loadFirstPage,
      child: ListView.builder(
        controller: _scrollController,
        itemCount: _items.length + 1 + (role.canManageProjects ? 1 : 0),
        itemBuilder: (context, index) {
          if (index < _items.length) {
            final project = _items[index];
            return ListTile(
              leading: Hero(
                tag: 'project-icon-${project.id}',
                child: EmojiBadge(
                  emoji: project.icon,
                  color: colorForKey(project.id),
                ),
              ),
              title: Text(
                project.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Text(currency.format(project.totalSpent)),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => ProjectDetailScreen(project: project),
                ),
              ),
              onLongPress: () => _showProjectMenu(project),
            );
          }
          if (index == _items.length) {
            if (_loading) {
              return const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator()),
              );
            }
            return const SizedBox.shrink();
          }
          return ListTile(
            leading: const Icon(Icons.add),
            title: const Text("New project"),
            onTap: _addProject,
          );
        },
      ),
    );
  }

  // A sortable table reads far better than a scrolling list once there are
  // enough projects to be worth reviewing on a wide screen — mouse+keyboard
  // users can scan Name/Total at a glance instead of scrolling tile by tile.
  Widget _buildDesktopTable(
    BuildContext context,
    NumberFormat currency,
    Role role,
  ) {
    if (_items.isEmpty) {
      return EmptyState(
        icon: Icons.folder_off_outlined,
        title: "No projects yet",
        subtitle: role.canManageProjects
            ? "Create your first project to start tracking purchases."
            : "Ask an admin to add a project.",
        action: role.canManageProjects
            ? FilledButton.icon(
                onPressed: _addProject,
                icon: const Icon(Icons.add),
                label: const Text("New project"),
              )
            : null,
      );
    }

    final sorted = [..._items]
      ..sort((a, b) => _sortAscending ? _compare(a, b) : _compare(b, a));

    return SingleChildScrollView(
      controller: _scrollController,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 4),
            child: Align(
              alignment: Alignment.centerRight,
              child: role.canManageProjects
                  ? FilledButton.icon(
                      onPressed: _addProject,
                      icon: const Icon(Icons.add),
                      label: const Text("New project"),
                    )
                  : null,
            ),
          ),
          Card(
            clipBehavior: Clip.antiAlias,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                sortColumnIndex: _sortColumn,
                sortAscending: _sortAscending,
                columns: [
                  const DataColumn(label: Text("")),
                  DataColumn(
                    label: const Text("Name"),
                    onSort: (i, asc) => setState(() {
                      _sortColumn = i;
                      _sortAscending = asc;
                    }),
                  ),
                  DataColumn(
                    label: const Text("Total spent"),
                    numeric: true,
                    onSort: (i, asc) => setState(() {
                      _sortColumn = i;
                      _sortAscending = asc;
                    }),
                  ),
                  const DataColumn(label: Text("")),
                ],
                rows: [
                  for (final project in sorted)
                    DataRow(
                      onSelectChanged: (_) => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => ProjectDetailScreen(project: project),
                        ),
                      ),
                      cells: [
                        DataCell(
                          EmojiBadge(
                            emoji: project.icon,
                            color: colorForKey(project.id),
                            size: 32,
                          ),
                        ),
                        DataCell(Text(project.name)),
                        DataCell(Text(currency.format(project.totalSpent))),
                        DataCell(
                          role.canManageProjects
                              ? IconButton(
                                  icon: const Icon(Icons.more_vert),
                                  tooltip: "More",
                                  onPressed: () => _showProjectMenu(project),
                                )
                              : const SizedBox.shrink(),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator()),
            ),
          if (_hasMore && !_loading)
            Center(
              child: TextButton(
                onPressed: _loadNextPage,
                child: const Text("Load more"),
              ),
            ),
        ],
      ),
    );
  }

  int _compare(Project a, Project b) => _sortColumn == 2
      ? a.totalSpent.compareTo(b.totalSpent)
      : a.name.toLowerCase().compareTo(b.name.toLowerCase());
}
