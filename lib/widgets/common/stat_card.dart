import 'package:flutter/material.dart';

import 'icon_badge.dart';
import 'spacing.dart';

/// A metric tile — colored icon badge, big value, label. `badgeColor` gives
/// each stat its own identity color (see `theme.dart`'s category palette) so
/// a row of these reads as distinct metrics rather than four identical gray
/// icons; omit it to fall back to a plain neutral/emphasized icon.
class StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final bool emphasize;
  final Color? badgeColor;

  const StatCard({super.key, required this.icon, required this.label, required this.value, this.emphasize = false, this.badgeColor});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (badgeColor != null)
              IconBadge(icon: icon, color: badgeColor!)
            else
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
