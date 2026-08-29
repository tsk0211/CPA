import 'package:flutter/material.dart';

/// Phones vary in width but content shouldn't stretch edge-to-edge forever
/// on a tablet or foldable — centers content with a readable max width,
/// full-bleed below that. Wrap list/detail bodies in this, not Scaffold
/// itself, so app bars/nav bars stay full width.
class ResponsiveCenter extends StatelessWidget {
  final Widget child;
  final double maxWidth;

  const ResponsiveCenter({super.key, required this.child, this.maxWidth = 720});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}
