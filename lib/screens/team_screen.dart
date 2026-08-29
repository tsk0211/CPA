import 'dart:async';

import 'package:flutter/material.dart';

import '../models/audit_entry.dart';
import '../models/role.dart';
import '../models/user.dart';
import '../state/app_scope.dart';
import '../widgets/add_user_sheet.dart';
import '../widgets/audit_entry_tile.dart';
import '../widgets/responsive_center.dart';
import '../widgets/role_badge.dart';

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
          child: TabBarView(controller: _tabController, children: const [_UsersTab(), _GlobalActivityTab()]),
        ),
      );
    }
    // Analyst: Team screen exists but only the Activity segment is usable.
    return Scaffold(
      appBar: AppBar(title: const Text("Team")),
      body: const ResponsiveCenter(child: _GlobalActivityTab()),
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
          child: TextField(
            controller: _searchController,
            decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: "Search team…", isDense: true),
            onChanged: _onSearchChanged,
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : ListView.builder(
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
                ),
        ),
      ],
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

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // AppScope.of(context) isn't valid in initState — didChangeDependencies
    // is the correct hook, guarded to fire only once.
    if (!_bootstrapped) {
      _bootstrapped = true;
      _load();
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await AppScope.of(context).auditLog.list(page: 1);
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

  @override
  Widget build(BuildContext context) {
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
                final result = await AppScope.of(context).auditLog.list(page: _page + 1);
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
