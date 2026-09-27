import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../api/api_exception.dart';
import '../models/audit_entry.dart';
import '../models/project.dart';
import '../models/role.dart';
import '../models/user.dart';
import '../state/app_scope.dart';
import '../widgets/add_user_sheet.dart';
import '../widgets/audit_entry_tile.dart';
import '../widgets/breakpoints.dart';
import '../widgets/responsive_center.dart';
import '../widgets/role_badge.dart';

// Kept in sync with widgets/audit_entry_tile.dart's _actionLabels — the
// filter dropdown's options need the same human-readable labels.
const _auditActionLabels = {
  "project.create": "Created project",
  "project.rename": "Edited project",
  "project.auto_approve_threshold_change": "Changed auto-approve threshold",
  "project.delete": "Deleted project",
  "purchase.create": "Logged a purchase",
  "purchase.edit": "Edited a purchase",
  "purchase.delete": "Deleted a purchase",
  "purchase.approve": "Approved a purchase",
  "purchase.reject": "Rejected a purchase",
  "user.create": "Created an account",
  "user.role_change": "Changed a role",
  "user.deactivate": "Deactivated an account",
};

class TeamScreen extends StatefulWidget {
  const TeamScreen({super.key});

  @override
  State<TeamScreen> createState() => _TeamScreenState();
}

class _TeamScreenState extends State<TeamScreen> with SingleTickerProviderStateMixin {
  TabController? _tabController;

  @override
  Widget build(BuildContext context) {
    final role = AppScope.of(context).session.user!.role;
    if (role.canManageUsers) {
      _tabController ??= TabController(length: 2, vsync: this);
      return Scaffold(
        appBar: AppBar(title: const Text("Team"), bottom: TabBar(controller: _tabController, tabs: const [Tab(text: "Users"), Tab(text: "Activity")])),
        body: ResponsiveCenter(
          maxWidth: isDesktop(context) ? 1100 : 720,
          child: TabBarView(controller: _tabController, children: const [_UsersTab(), _GlobalActivityTab()]),
        ),
      );
    }
    // Analyst: Team screen exists but only the Activity segment is usable.
    return Scaffold(
      appBar: AppBar(title: const Text("Team")),
      body: ResponsiveCenter(maxWidth: isDesktop(context) ? 1100 : 720, child: const _GlobalActivityTab()),
    );
  }

  @override
  void dispose() {
    _tabController?.dispose();
    super.dispose();
  }
}

class _UsersTab extends StatefulWidget {
  const _UsersTab();

  @override
  State<_UsersTab> createState() => _UsersTabState();
}

class _UsersTabState extends State<_UsersTab> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  List<TeamMember> _items = [];
  bool _loading = true;
  bool _bootstrapped = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // AppScope.of(context) isn't valid in initState — didChangeDependencies
    // is the correct hook, guarded to fire only once.
    if (!_bootstrapped) {
      _bootstrapped = true;
      _load("");
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load(String search) async {
    setState(() => _loading = true);
    final result = await AppScope.of(context).users.list(search: search);
    if (!mounted) return;
    setState(() {
      _items = result.items;
      _loading = false;
    });
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () => _load(value));
  }

  Future<void> _addUser() async {
    final role = AppScope.of(context).session.user!.role;
    final created = await showAddUserSheet(context, canCreateAdmin: role == Role.owner);
    if (created == true) _load(_searchController.text);
  }

  Future<void> _showUserActions(TeamMember target) async {
    final scope = AppScope.of(context);
    final me = scope.session.user!;
    if (target.role == Role.owner || target.id == me.id) return;

    final actorIsOwner = me.role == Role.owner;
    final canAct = actorIsOwner || target.role != Role.admin;
    if (!canAct) return;

    final assignable = [Role.member, Role.analyst, if (actorIsOwner) Role.admin].where((r) => r != target.role).toList();

    final action = await showModalBottomSheet<Object>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final r in assignable)
              ListTile(leading: const Icon(Icons.swap_horiz), title: Text("Make ${r.label}"), onTap: () => Navigator.pop(context, r)),
            ListTile(
              leading: Icon(Icons.person_off_outlined, color: Theme.of(context).colorScheme.error),
              title: Text("Deactivate", style: TextStyle(color: Theme.of(context).colorScheme.error)),
              onTap: () => Navigator.pop(context, "deactivate"),
            ),
          ],
        ),
      ),
    );

    if (action is Role) {
      await scope.users.changeRole(target.id, action);
      if (mounted) _load(_searchController.text);
    } else if (action == "deactivate") {
      if (!mounted) return;
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text("Deactivate ${target.name}?"),
          content: const Text("They'll be signed out immediately and can no longer log in."),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text("Cancel")),
            FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text("Deactivate")),
          ],
        ),
      );
      if (confirmed == true) {
        await scope.users.deactivate(target.id);
        if (mounted) _load(_searchController.text);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: "Search team…", isDense: true),
                  onChanged: _onSearchChanged,
                ),
              ),
              if (isDesktop(context)) ...[
                const SizedBox(width: 12),
                FilledButton.icon(onPressed: _addUser, icon: const Icon(Icons.person_add_alt), label: const Text("New account")),
              ],
            ],
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : isDesktop(context)
                  ? _buildDesktopTable(context)
                  : _buildList(context),
        ),
      ],
    );
  }

  Widget _buildList(BuildContext context) {
    return ListView.builder(
      itemCount: _items.length + 1,
      itemBuilder: (context, index) {
        if (index == _items.length) {
          return ListTile(leading: const Icon(Icons.person_add_alt), title: const Text("New account"), onTap: _addUser);
        }
        final member = _items[index];
        return ListTile(
          leading: CircleAvatar(child: Text(member.name.isNotEmpty ? member.name[0].toUpperCase() : "?")),
          title: Text(member.name, maxLines: 1, overflow: TextOverflow.ellipsis),
          subtitle: Text(member.email, maxLines: 1, overflow: TextOverflow.ellipsis),
          trailing: RoleBadge(role: member.role),
          onTap: () => _showUserActions(member),
        );
      },
    );
  }

  Widget _buildDesktopTable(BuildContext context) {
    if (_items.isEmpty) return const Center(child: Text("No team members yet."));
    return SingleChildScrollView(
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          columns: const [
            DataColumn(label: Text("Name")),
            DataColumn(label: Text("Email")),
            DataColumn(label: Text("Role")),
            DataColumn(label: Text("")),
          ],
          rows: [
            for (final member in _items)
              DataRow(
                cells: [
                  DataCell(Text(member.name)),
                  DataCell(Text(member.email)),
                  DataCell(RoleBadge(role: member.role)),
                  DataCell(IconButton(icon: const Icon(Icons.more_vert), onPressed: () => _showUserActions(member))),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

class _GlobalActivityTab extends StatefulWidget {
  const _GlobalActivityTab();

  @override
  State<_GlobalActivityTab> createState() => _GlobalActivityTabState();
}

class _GlobalActivityTabState extends State<_GlobalActivityTab> {
  final List<AuditEntry> _items = [];
  int _page = 1;
  bool _hasMore = true;
  bool _loading = true;
  bool _bootstrapped = false;

  // Filters: person and project filter by id (fetched once, shown by name
  // in the dropdowns); action filters by the same string audit entries are
  // stored with. All four combine with AND on the server.
  List<TeamMember> _people = [];
  List<Project> _projects = [];
  TeamMember? _selectedPerson;
  Project? _selectedProject;
  String? _selectedAction;
  DateTimeRange? _dateRange;

  bool _exporting = false;
  String? _exportError;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // AppScope.of(context) isn't valid in initState — didChangeDependencies
    // is the correct hook, guarded to fire only once.
    if (!_bootstrapped) {
      _bootstrapped = true;
      _loadFilterOptions();
      _load();
    }
  }

  // Small teams/project counts in practice (see Team/Projects screens'
  // own paginated search) — one page of up to 100 is enough for a filter
  // dropdown without needing its own search-as-you-type sheet.
  Future<void> _loadFilterOptions() async {
    final scope = AppScope.of(context);
    final people = await scope.users.list(limit: 100);
    final projects = await scope.projects.list(limit: 100);
    if (!mounted) return;
    setState(() {
      _people = people.items;
      _projects = projects.items;
    });
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await AppScope.of(context).auditLog.list(
          page: 1,
          actorId: _selectedPerson?.id,
          action: _selectedAction,
          projectId: _selectedProject?.id,
          from: _dateRange?.start,
          to: _dateRange?.end,
        );
    if (!mounted) return;
    setState(() {
      _items
        ..clear()
        ..addAll(result.items);
      _hasMore = result.hasMore;
      _page = 1;
      _loading = false;
    });
  }

  Future<void> _pickDateRange() async {
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      initialDateRange: _dateRange,
    );
    if (!mounted || range == null) return;
    setState(() => _dateRange = range);
    _load();
  }

  Future<void> _export() async {
    setState(() {
      _exporting = true;
      _exportError = null;
    });
    try {
      final (bytes, filename) = await AppScope.of(context).auditLog.export(
            actorId: _selectedPerson?.id,
            action: _selectedAction,
            projectId: _selectedProject?.id,
            from: _dateRange?.start,
            to: _dateRange?.end,
          );
      final dir = await getTemporaryDirectory();
      final file = File("${dir.path}/$filename");
      await file.writeAsBytes(bytes);
      await Share.shareXFiles([XFile(file.path)], text: "CPA audit log export");
    } on ApiException catch (e) {
      setState(() => _exportError = e.message);
    } on NetworkUnavailableException {
      setState(() => _exportError = "Can't reach the server. Export needs a live connection.");
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  bool get _hasFilters =>
      _selectedPerson != null || _selectedProject != null || _selectedAction != null || _dateRange != null;

  void _clearFilters() {
    setState(() {
      _selectedPerson = null;
      _selectedProject = null;
      _selectedAction = null;
      _dateRange = null;
    });
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              SizedBox(
                width: 180,
                child: DropdownButtonFormField<TeamMember>(
                  initialValue: _selectedPerson,
                  decoration: const InputDecoration(labelText: "Person", isDense: true),
                  isExpanded: true,
                  items: [
                    const DropdownMenuItem(value: null, child: Text("Anyone")),
                    for (final person in _people) DropdownMenuItem(value: person, child: Text(person.name, overflow: TextOverflow.ellipsis)),
                  ],
                  onChanged: (value) {
                    setState(() => _selectedPerson = value);
                    _load();
                  },
                ),
              ),
              SizedBox(
                width: 200,
                child: DropdownButtonFormField<String>(
                  initialValue: _selectedAction,
                  decoration: const InputDecoration(labelText: "Action", isDense: true),
                  isExpanded: true,
                  items: [
                    const DropdownMenuItem(value: null, child: Text("Any action")),
                    for (final entry in _auditActionLabels.entries)
                      DropdownMenuItem(value: entry.key, child: Text(entry.value, overflow: TextOverflow.ellipsis)),
                  ],
                  onChanged: (value) {
                    setState(() => _selectedAction = value);
                    _load();
                  },
                ),
              ),
              SizedBox(
                width: 180,
                child: DropdownButtonFormField<Project>(
                  initialValue: _selectedProject,
                  decoration: const InputDecoration(labelText: "Project", isDense: true),
                  isExpanded: true,
                  items: [
                    const DropdownMenuItem(value: null, child: Text("Any project")),
                    for (final project in _projects) DropdownMenuItem(value: project, child: Text(project.name, overflow: TextOverflow.ellipsis)),
                  ],
                  onChanged: (value) {
                    setState(() => _selectedProject = value);
                    _load();
                  },
                ),
              ),
              OutlinedButton.icon(
                onPressed: _pickDateRange,
                icon: const Icon(Icons.date_range),
                label: Text(_dateRange == null ? "Date range" : "${_fmtDate(_dateRange!.start)} – ${_fmtDate(_dateRange!.end)}"),
              ),
              if (_hasFilters) TextButton(onPressed: _clearFilters, child: const Text("Clear filters")),
              FilledButton.icon(
                onPressed: _exporting ? null : _export,
                icon: _exporting
                    ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.ios_share),
                label: const Text("Export .xlsx"),
              ),
            ],
          ),
        ),
        if (_exportError != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(_exportError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ),
        Expanded(child: _buildList()),
      ],
    );
  }

  String _fmtDate(DateTime d) => "${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}";

  Widget _buildList() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_items.isEmpty) return const Center(child: Text("No activity recorded yet."));
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        itemCount: _items.length + (_hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index >= _items.length) {
            return TextButton(
              onPressed: () async {
                final result = await AppScope.of(context).auditLog.list(
                      page: _page + 1,
                      actorId: _selectedPerson?.id,
                      action: _selectedAction,
                      projectId: _selectedProject?.id,
                      from: _dateRange?.start,
                      to: _dateRange?.end,
                    );
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
  }
}
