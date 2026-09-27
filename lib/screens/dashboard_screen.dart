import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/api_exception.dart';
import '../models/purchase.dart';
import '../state/app_scope.dart';
import '../widgets/common/empty_state.dart';
import '../widgets/common/error_text.dart';
import '../widgets/common/icon_badge.dart';
import '../widgets/common/skeleton.dart';
import '../widgets/common/spend_trend_chart.dart';
import '../widgets/common/stat_card.dart';
import '../widgets/responsive_center.dart';
import '../theme.dart';
import 'profile_screen.dart';

/// Desktop-only landing page (see home_shell.dart for why it's not on
/// mobile) — an at-a-glance overview for whoever's reviewing/managing the
/// account, not a feature screen in its own right. Every stat here links
/// back to an existing screen/endpoint; the spend trend chart is the one
/// exception — see PurchasesApi.trend() / GET /purchases/trend.
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
  List<(DateTime, double)>? _trend;

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
      // Each call is kicked off here (a Future starts running the moment
      // it's created, not when awaited) and only awaited below, so all of
      // these run concurrently — the limit=1 lookups are cheap, but
      // trend() is a full 30-day aggregation and shouldn't sit at the end
      // of a serial chain behind four other requests.
      final projectsFuture = scope.projects.list(page: 1, limit: 1);
      final monthSpendFuture = role.canExport ? scope.purchases.search(page: 1, limit: 1, from: startOfMonth) : null;
      final pendingFuture = role.canReviewPurchases ? scope.purchases.pending(page: 1, limit: 1) : null;
      final teamFuture = role.canManageUsers ? scope.users.list(page: 1, limit: 1) : null;
      final recentFuture = scope.purchases.recent(page: 1, limit: 8);
      final trendFuture = role.canExport ? scope.purchases.trend(days: 30) : null;

      final projects = await projectsFuture;
      final monthSpend = monthSpendFuture == null ? null : (await monthSpendFuture).$2;
      final pending = pendingFuture == null ? null : await pendingFuture;
      final team = teamFuture == null ? null : await teamFuture;
      final recent = await recentFuture;
      final trend = trendFuture == null ? null : await trendFuture;
      if (!mounted) return;
      setState(() {
        _activeProjects = projects.total;
        _monthSpend = monthSpend;
        _pendingReview = pending?.total;
        _teamSize = team?.total;
        _recent = recent.items;
        _trend = trend;
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
                          _buildStatRow(context),
                          if (_trend != null) ...[
                            const SizedBox(height: 24),
                            _buildTrendCard(context),
                          ],
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
                                      leading: EmojiBadge(emoji: p.projectIcon ?? "📁", color: colorForKey(p.projectId)),
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

  // Dashboard only ever renders on desktop (see home_shell.dart), so this
  // can safely be a real full-width row rather than a Wrap of fixed-width
  // cards — each visible stat gets an equal share of the available width
  // instead of leaving the rest of a wide monitor empty.
  Widget _buildStatRow(BuildContext context) {
    final cards = [
      StatCard(icon: Icons.folder_outlined, label: "Active projects", value: "${_activeProjects ?? '—'}", badgeColor: const Color(0xFF3B82F6)),
      // A mutable field, not a local, so `if (_monthSpend != null)` alone
      // doesn't promote it to non-null — capture it first.
      if (_monthSpend case final monthSpend?)
        StatCard(
          icon: Icons.payments_outlined,
          label: "Approved spend this month",
          value: NumberFormat.simpleCurrency().format(monthSpend),
          badgeColor: const Color(0xFF14B8A6),
        ),
      if (_pendingReview != null)
        StatCard(
          icon: Icons.fact_check_outlined,
          label: "Awaiting review",
          value: "$_pendingReview",
          emphasize: _pendingReview! > 0,
          badgeColor: const Color(0xFFF59E0B),
        ),
      if (_teamSize != null) StatCard(icon: Icons.groups_outlined, label: "Team members", value: "$_teamSize", badgeColor: const Color(0xFFA855F7)),
    ];

    return Row(
      children: [
        for (var i = 0; i < cards.length; i++) ...[
          if (i > 0) const SizedBox(width: 16),
          Expanded(child: cards[i]),
        ],
      ],
    );
  }

  Widget _buildTrendCard(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 24, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Spend trend", style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text("Approved spend, last 30 days", style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 16),
            SizedBox(height: 220, child: SpendTrendChart(points: _trend!)),
          ],
        ),
      ),
    );
  }
}
