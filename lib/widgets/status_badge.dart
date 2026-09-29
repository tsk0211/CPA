import 'package:flutter/material.dart';

import '../models/purchase.dart';

/// Small colored pill for a purchase's review status. Approved is the
/// overwhelmingly common case (owner/admin entries are auto-approved, and
/// most member entries get approved quickly), so it renders nothing rather
/// than adding a badge to every single row — only pending/rejected, the
/// states someone actually needs to notice, draw the eye.
class StatusBadge extends StatelessWidget {
  final PurchaseStatus status;
  const StatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    if (status == PurchaseStatus.approved) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    final (label, color) = switch (status) {
      PurchaseStatus.pending => ("Pending", scheme.tertiary),
      PurchaseStatus.rejected => ("Rejected", scheme.error),
      PurchaseStatus.approved => ("", scheme.primary),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: color, fontWeight: FontWeight.w600)),
    );
  }
}
