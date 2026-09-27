import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/api_exception.dart';
import '../models/purchase.dart';
import '../state/app_scope.dart';
import '../widgets/common/empty_state.dart';
import '../widgets/common/error_text.dart';
import '../widgets/common/skeleton.dart';
import '../widgets/common/stat_card.dart';
import '../widgets/responsive_center.dart';
import 'profile_screen.dart';

/// Desktop-only landing page (see home_shell.dart for why it's not on
/// mobile) — an at-a-glance overview for whoever's reviewing/managing the
/// account, not a feature screen in its own right. Every stat here links
/// back to an existing screen/endpoint; nothing new is computed server-side
/// just for this view. Deliberately no charts (see README — a project
/// decision made for Reports too): stat tiles + a recent-activity list.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _bootstrapped = false;
  bool _loading = true;
  String? _error;

  int? _activeProjects;
  double? _monthSpend;
  int? _pendingReview;
  int? _teamSize;
  List<Purchase> _recent = [];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_bootstrapped) {
      _bootstrapped = true;
      _load();
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final scope = AppScope.of(context);
    final role = scope.session.user!.role;
    final startOfMonth = DateTime(DateTime.now().year, DateTime.now().month, 1);

    try {
      // Sequential rather than Future.wait: the calls return different
      // types (some role-gated and nullable), and this is a handful of
      // cheap limit=1 lookups — not worth the type gymnastics to
      // parallelize for a dashboard's initial load.
      final projects = await scope.projects.list(page: 1, limit: 1);
      final monthSpend = role.canExport ? (await scope.purchases.search(page: 1, limit: 1, from: startOfMonth)).$2 : null;
      final pending = role.canReviewPurchases ? await scope.purchases.pending(page: 1, limit: 1) : null;
      final team = role.canManageUsers ? await scope.users.list(page: 1, limit: 1) : null;
      final recent = await scope.purchases.recent(page: 1, limit: 8);
      if (!mounted) return;
      setState(() {
        _activeProjects = projects.total;
        _monthSpend = monthSpend;
        _pendingReview = pending?.total;
        _teamSize = team?.total;
        _recent = recent.items;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } on NetworkUnavailableException {
      if (mounted) setState(() => _error = networkUnavailableMessage);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = AppScope.of(context).session.user!;
    return Scaffold(
      appBar: AppBar(
        title: const Text("Dashboard"),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), tooltip: "Refresh", onPressed: _load),
          IconButton(
            icon: const Icon(Icons.account_circle_outlined),
            tooltip: "Profile",
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ProfileScreen())),
          ),
        ],
      ),
      body: ResponsiveCenter(
        maxWidth: 1200,
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: _loading && _recent.isEmpty
              ? const SkeletonList(key: ValueKey('loading'))
              : _error != null
                  ? EmptyState(
                      key: const ValueKey('error'),
                      icon: Icons.error_outline,
                      title: "Couldn't load the dashboard",
                      subtitle: _error,
                      action: FilledButton(onPressed: _load, child: const Text("Retry")),
                    )
                  : RefreshIndicator(
                      key: const ValueKey('content'),
                    onRefresh: _load,
                    child: ListView(
                      padding: const EdgeInsets.all(24),
                      children: [
                        Text("Welcome back, ${user.name.split(' ').first}", style: Theme.of(context).textTheme.headlineSmall),
                        const SizedBox(height: 20),
                        Wrap(
                          spacing: 16,
                          runSpacing: 16,
                          children: [
                            StatCard(icon: Icons.folder_outlined, label: "Active projects", value: "${_activeProjects ?? '—'}"),
                            // A mutable field, not a local, so `if (_monthSpend != null)`
                            // alone doesn't promote it to non-null — capture it first.
                            if (_monthSpend case final monthSpend?)
                              StatCard(icon: Icons.payments_outlined, label: "Approved spend this month", value: NumberFormat.simpleCurrency().format(monthSpend)),
                            if (_pendingReview != null)
                              StatCard(
                                icon: Icons.fact_check_outlined,
                                label: "Awaiting review",
                                value: "$_pendingReview",
                                emphasize: _pendingReview! > 0,
                              ),
                            if (_teamSize != null) StatCard(icon: Icons.groups_outlined, label: "Team members", value: "$_teamSize"),
                          ],
                        ),
                        const SizedBox(height: 32),
                        Text("Recent activity", style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 8),
                        if (_recent.isEmpty)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 16),
                            child: EmptyState(icon: Icons.receipt_long_outlined, title: "Nothing logged yet"),
                          )
                        else
                          Card(
                            child: Column(
                              children: [
                                for (final p in _recent)
                                  ListTile(
                                    leading: Text(p.projectIcon ?? "📁", style: const TextStyle(fontSize: 20)),
                                    title: Text(p.description, maxLines: 1, overflow: TextOverflow.ellipsis),
                                    subtitle: Text(
                                      [if (p.projectName != null) p.projectName!, p.createdByName ?? ''].join(" · "),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    trailing: Text(NumberFormat.simpleCurrency().format(p.amount), style: const TextStyle(fontWeight: FontWeight.bold)),
                                  ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
        ),
      ),
    );
  }
}

