import 'package:flutter/material.dart';

import '../models/role.dart';
import '../state/app_scope.dart';
import '../widgets/breakpoints.dart';
import 'dashboard_screen.dart';
import 'projects_screen.dart';
import 'reports_screen.dart';
import 'review_screen.dart';
import 'team_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  int _pendingCount = 0;
  bool _bootstrapped = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_bootstrapped) {
      _bootstrapped = true;
      final role = AppScope.of(context).session.user!.role;
      if (role.canReviewPurchases) _refreshPendingCount();
    }
  }

  // Only the count is needed here (the badge on the Review nav icon) — the
  // 1-item page is cheaper than fetching the whole queue just to measure it.
  // Best-effort: this runs unawaited from didChangeDependencies, so a
  // failure (offline, a slow cold start) should just leave the badge
  // showing its last-known count rather than surfacing an error nobody
  // asked for.
  Future<void> _refreshPendingCount() async {
    try {
      final result = await AppScope.of(context).purchases.pending(page: 1, limit: 1);
      if (!mounted) return;
      setState(() => _pendingCount = result.total);
    } catch (_) {
      // Ignored — see above.
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = AppScope.of(context).session.user!.role;
    final desktop = isDesktop(context);

    final destinations = <(String, Widget, Widget, Widget)>[
      // The dashboard is a desktop-only landing page, deliberately — see
      // project memory: an earlier "Today" tab as the mobile front door was
      // reconsidered as bad design, and the same reasoning applies here.
      // Desktop has the screen real estate (and the admin-review use case)
      // to justify an overview a phone doesn't.
      if (desktop) ("Dashboard", const Icon(Icons.dashboard_outlined), const Icon(Icons.dashboard), const DashboardScreen()),
      ("Projects", const Icon(Icons.folder_outlined), const Icon(Icons.folder), const ProjectsScreen()),
      if (role.canReviewPurchases)
        (
          "Review",
          _badged(const Icon(Icons.fact_check_outlined), _pendingCount),
          _badged(const Icon(Icons.fact_check), _pendingCount),
          ReviewScreen(onReviewed: _refreshPendingCount),
        ),
      if (role.canExport) ("Reports", const Icon(Icons.bar_chart_outlined), const Icon(Icons.bar_chart), const ReportsScreen()),
      if (role == Role.owner || role == Role.admin || role.canSeeActivityLog)
        ("Team", const Icon(Icons.groups_outlined), const Icon(Icons.groups), const TeamScreen()),
    ];

    final safeIndex = _index.clamp(0, destinations.length - 1);
    final body = destinations[safeIndex].$4;

    if (desktop) {
      return Scaffold(
        body: Row(
          children: [
            NavigationRail(
              selectedIndex: safeIndex,
              onDestinationSelected: (i) => setState(() => _index = i),
              labelType: NavigationRailLabelType.all,
              destinations: [
                for (final d in destinations) NavigationRailDestination(icon: d.$2, selectedIcon: d.$3, label: Text(d.$1)),
              ],
            ),
            const VerticalDivider(width: 1),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: KeyedSubtree(key: ValueKey(safeIndex), child: body),
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 200),
        child: KeyedSubtree(key: ValueKey(safeIndex), child: body),
      ),
      bottomNavigationBar: destinations.length > 1
          ? NavigationBar(
              selectedIndex: safeIndex,
              onDestinationSelected: (i) => setState(() => _index = i),
              destinations: [
                for (final d in destinations) NavigationDestination(icon: d.$2, selectedIcon: d.$3, label: d.$1),
              ],
            )
          : null,
    );
  }

  Widget _badged(Widget icon, int count) => count > 0 ? Badge(label: Text("$count"), child: icon) : icon;
}
