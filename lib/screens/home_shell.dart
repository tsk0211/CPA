import 'package:flutter/material.dart';

import '../models/role.dart';
import '../state/app_scope.dart';
import 'projects_screen.dart';
import 'reports_screen.dart';
import 'team_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final role = AppScope.of(context).session.user!.role;
    final destinations = <(String, IconData, IconData, Widget)>[
      ("Projects", Icons.folder_outlined, Icons.folder, const ProjectsScreen()),
      if (role.canExport) ("Reports", Icons.bar_chart_outlined, Icons.bar_chart, const ReportsScreen()),
      if (role == Role.owner || role == Role.admin || role.canSeeActivityLog)
        ("Team", Icons.groups_outlined, Icons.groups, const TeamScreen()),
    ];

    final safeIndex = _index.clamp(0, destinations.length - 1);

    return Scaffold(
      body: destinations[safeIndex].$4,
      bottomNavigationBar: destinations.length > 1
          ? NavigationBar(
              selectedIndex: safeIndex,
              onDestinationSelected: (i) => setState(() => _index = i),
              destinations: [
                for (final d in destinations)
                  NavigationDestination(icon: Icon(d.$2), selectedIcon: Icon(d.$3), label: d.$1),
              ],
            )
          : null,
    );
  }
}
