import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import 'spacing.dart';

/// A single shimmering placeholder block — the building block for
/// screen-specific skeleton layouts (a stat card, a table row, a list tile).
class SkeletonBox extends StatelessWidget {
  final double height;
  final double? width;
  final BorderRadius? borderRadius;

  const SkeletonBox({super.key, required this.height, this.width, this.borderRadius});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      height: height,
      width: width,
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest,
        borderRadius: borderRadius ?? BorderRadius.circular(Corners.sm),
      ),
    );
  }
}

/// Wraps its child in a shimmer sweep, themed off the current color scheme
/// so it reads correctly in both light and dark mode. Use around a column of
/// [SkeletonBox]es for a first-load placeholder.
class Shimmering extends StatelessWidget {
  final Widget child;
  const Shimmering({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Shimmer.fromColors(
      baseColor: scheme.surfaceContainerHighest,
      highlightColor: scheme.surfaceContainerLowest,
      child: child,
    );
  }
}

/// A generic "N skeleton rows" placeholder for first-load list/table states —
/// each row is a simple bar; screens with a more specific shape (e.g. a stat
/// card grid) can compose [SkeletonBox]/[Shimmering] directly instead.
class SkeletonList extends StatelessWidget {
  final int itemCount;
  final double itemHeight;

  const SkeletonList({super.key, this.itemCount = 6, this.itemHeight = 64});

  @override
  Widget build(BuildContext context) {
    return Shimmering(
      child: ListView.separated(
        padding: const EdgeInsets.all(Spacing.md),
        itemCount: itemCount,
        separatorBuilder: (_, _) => const SizedBox(height: Spacing.sm),
        itemBuilder: (context, index) => SkeletonBox(height: itemHeight),
      ),
    );
  }
}
