import 'package:flutter/material.dart';

/// Small cloud-off icon shown next to a pending purchase that was captured
/// offline and synced later — without this, a reviewer might wonder why a
/// small purchase that should've auto-approved is sitting in the queue.
class OfflineCapturedBadge extends StatelessWidget {
  const OfflineCapturedBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: "Captured offline — always reviewed regardless of amount",
      child: Icon(Icons.cloud_off, size: 16, color: Theme.of(context).colorScheme.onSurfaceVariant),
    );
  }
}
