import 'package:flutter/material.dart';

import 'spacing.dart';

/// A small metric tile — icon, big value, label — promoted from
/// `dashboard_screen.dart`'s original private `_StatCard` into a shared
/// widget so any future summary tile (e.g. in Reports) can reuse the same
/// look instead of a new one-off.
class StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final bool emphasize;

  const StatCard({super.key, required this.icon, required this.label, required this.value, this.emphasize = false});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Container(
        width: 220,
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: emphasize ? scheme.tertiary : scheme.onSurfaceVariant),
            const SizedBox(height: Spacing.sm + 4),
            Text(
              value,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold, color: emphasize ? scheme.tertiary : null),
            ),
            const SizedBox(height: Spacing.xs),
            Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant)),
          ],
        ),
      ),
    );
  }
}
