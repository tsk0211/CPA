import 'package:flutter/material.dart';

import 'spacing.dart';

/// Consistent "nothing here yet" placeholder — icon + title + optional
/// subtitle + optional call-to-action — replacing each screen's inline
/// "No X yet." Text with something that actually looks intentional.
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? action;

  const EmptyState({super.key, required this.icon, required this.title, this.subtitle, this.action});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final onSurfaceVariant = theme.colorScheme.onSurfaceVariant;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(Spacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: onSurfaceVariant),
            const SizedBox(height: Spacing.md),
            Text(title, style: theme.textTheme.titleMedium, textAlign: TextAlign.center),
            if (subtitle != null) ...[
              const SizedBox(height: Spacing.xs),
              Text(
                subtitle!,
                style: theme.textTheme.bodyMedium?.copyWith(color: onSurfaceVariant),
                textAlign: TextAlign.center,
              ),
            ],
            if (action != null) ...[const SizedBox(height: Spacing.md), action!],
          ],
        ),
      ),
    );
  }
}
