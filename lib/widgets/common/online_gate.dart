import 'package:flutter/material.dart';

import '../../state/app_scope.dart';
import 'empty_state.dart';

/// Blocks [child] behind a "you're offline" placeholder whenever
/// connectivity is down — for screens whose data is too sensitive or
/// fast-changing to show from a stale local cache (see Team's user list and
/// per-user activity view). Unlike most of this app's screens, these
/// deliberately have *no* offline fallback: showing "go online" beats
/// showing something that might already be wrong.
class OnlineGate extends StatelessWidget {
  final Widget child;
  final String featureName;

  const OnlineGate({super.key, required this.child, required this.featureName});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: AppScope.of(context).connectivity,
      builder: (context, _) {
        final online = AppScope.of(context).connectivity.isOnline;
        if (!online) {
          return EmptyState(
            key: const ValueKey('offline'),
            icon: Icons.cloud_off,
            title: "You're offline",
            subtitle: "$featureName needs a live connection — it isn't cached, since the list can change at any time.",
          );
        }
        return child;
      },
    );
  }
}
