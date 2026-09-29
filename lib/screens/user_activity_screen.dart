import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../api/api_exception.dart';
import '../models/audit_entry.dart';
import '../models/project.dart';
import '../models/user.dart';
import '../state/app_scope.dart';
import '../utils/date_range.dart';
import '../widgets/audit_entry_tile.dart';
import '../widgets/common/colored_avatar.dart';
import '../widgets/common/empty_state.dart';
import '../widgets/common/error_text.dart';
import '../widgets/common/form_error_text.dart';
import '../widgets/common/loading_indicator.dart';
import '../widgets/common/online_gate.dart';
import '../widgets/common/skeleton.dart';
import '../widgets/responsive_center.dart';
import '../widgets/role_badge.dart';

// Kept in sync with widgets/audit_entry_tile.dart's own copy — see that
// file's comment for why this exists twice (filter dropdown vs. tile text).
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

String _messageFor(Object error) {
  if (error is ApiException) return error.message;
  if (error is NetworkUnavailableException) return networkUnavailableMessage;
  return "Something went wrong. Please try again.";
}

/// Owner/Admin drill-down onto one person's activity — everything they've
/// done, filterable by action/project/date range, exportable. Deliberately
/// online-only (see OnlineGate): this is account-oversight data, not
/// something that should ever be shown stale from a cache.
class UserActivityScreen extends StatelessWidget {
  final TeamMember member;
  const UserActivityScreen({super.key, required this.member});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(member.name),
      ),
      body: ResponsiveCenter(
        maxWidth: 900,
        child: OnlineGate(
          featureName: "Activity history",
          child: _UserActivityBody(member: member),
        ),
      ),
    );
  }
}

class _UserActivityBody extends StatefulWidget {
  final TeamMember member;
  const _UserActivityBody({required this.member});

  @override
  State<_UserActivityBody> createState() => _UserActivityBodyState();
}

class _UserActivityBodyState extends State<_UserActivityBody> {
  final List<AuditEntry> _items = [];
  int _page = 1;
  bool _hasMore = true;
  bool _loading = true;
  bool _bootstrapped = false;
  String? _error;

  List<Project> _projects = [];
  Project? _selectedProject;
  String? _selectedAction;
  DateTimeRange? _dateRange;

  bool _exporting = false;
  String? _exportError;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_bootstrapped) {
      _bootstrapped = true;
      _loadFilterOptions();
      _load();
    }
  }

  Future<void> _loadFilterOptions() async {
    try {
      final projects = await AppScope.of(context).projects.list(limit: 100);
      if (!mounted) return;
      setState(() => _projects = projects.items);
    } catch (_) {
      // Same reasoning as team_screen.dart's global activity tab — the
      // project filter is a convenience, not load-bearing.
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await AppScope.of(context).auditLog.list(
        page: 1,
        actorId: widget.member.id,
        action: _selectedAction,
        projectId: _selectedProject?.id,
        from: _dateRange == null ? null : startOfLocalDayUtc(_dateRange!.start),
        to: _dateRange == null ? null : endOfLocalDayUtc(_dateRange!.end),
      );
      if (!mounted) return;
      setState(() {
        _items
          ..clear()
          ..addAll(result.items);
        _hasMore = result.hasMore;
        _page = 1;
      });
    } catch (e) {
      if (mounted) setState(() => _error = _messageFor(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    try {
      final result = await AppScope.of(context).auditLog.list(
        page: _page + 1,
        actorId: widget.member.id,
        action: _selectedAction,
        projectId: _selectedProject?.id,
        from: _dateRange == null ? null : startOfLocalDayUtc(_dateRange!.start),
        to: _dateRange == null ? null : endOfLocalDayUtc(_dateRange!.end),
      );
      if (!mounted) return;
      setState(() {
        _items.addAll(result.items);
        _page += 1;
        _hasMore = result.hasMore;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_messageFor(e))));
      }
    }
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
        actorId: widget.member.id,
        action: _selectedAction,
        projectId: _selectedProject?.id,
        from: _dateRange == null ? null : startOfLocalDayUtc(_dateRange!.start),
        to: _dateRange == null ? null : endOfLocalDayUtc(_dateRange!.end),
      );
      await Share.shareXFiles([
        XFile.fromData(
          Uint8List.fromList(bytes),
          name: filename,
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
      ], text: "${widget.member.name}'s activity — CPA export");
    } catch (e) {
      if (mounted) setState(() => _exportError = _messageFor(e));
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  bool get _hasFilters => _selectedProject != null || _selectedAction != null || _dateRange != null;

  void _clearFilters() {
    setState(() {
      _selectedProject = null;
      _selectedAction = null;
      _dateRange = null;
    });
    _load();
  }

  String _fmtDate(DateTime d) => "${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}";

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Row(
            children: [
              ColoredAvatar(name: widget.member.name, radius: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(widget.member.email, style: Theme.of(context).textTheme.bodyMedium),
                  ],
                ),
              ),
              RoleBadge(role: widget.member.role),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
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
                    for (final project in _projects)
                      DropdownMenuItem(value: project, child: Text(project.name, overflow: TextOverflow.ellipsis)),
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
                icon: _exporting ? const InlineSpinner() : const Icon(Icons.ios_share),
                label: const Text("Export .xlsx"),
              ),
            ],
          ),
        ),
        if (_exportError != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: FormErrorText(_exportError),
          ),
        Expanded(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: _buildBody(),
          ),
        ),
      ],
    );
  }

  Widget _buildBody() {
    if (_loading && _items.isEmpty && _error == null) {
      return const SkeletonList(key: ValueKey('loading'));
    }
    if (_error != null && _items.isEmpty) {
      return EmptyState(
        key: const ValueKey('error'),
        icon: Icons.error_outline,
        title: "Couldn't load activity",
        subtitle: _error,
        action: FilledButton(onPressed: _load, child: const Text("Retry")),
      );
    }
    if (_items.isEmpty) {
      return EmptyState(
        key: const ValueKey('empty'),
        icon: Icons.history_toggle_off,
        title: _hasFilters ? "No activity matches these filters" : "No activity recorded yet",
      );
    }
    return KeyedSubtree(
      key: const ValueKey('content'),
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView.builder(
          itemCount: _items.length + (_hasMore ? 1 : 0),
          itemBuilder: (context, index) {
            if (index >= _items.length) {
              return TextButton(onPressed: _loadMore, child: const Text("Load more"));
            }
            return AuditEntryTile(entry: _items[index]);
          },
        ),
      ),
    );
  }
}
