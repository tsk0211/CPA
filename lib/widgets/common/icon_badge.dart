import 'package:flutter/material.dart';

/// A softly-tinted, rounded-square container around an icon — gives a plain
/// Material icon real visual weight and a distinct identity color, instead
/// of the flat single-gray-icon look used everywhere before this. Modeled
/// on the colored subject/asset badges common in richer Flutter app designs
/// (course subject icons, crypto row icons).
class IconBadge extends StatelessWidget {
  final IconData icon;
  final Color color;
  final double size;

  const IconBadge({super.key, required this.icon, required this.color, this.size = 44});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: color.withValues(alpha: 0.16), borderRadius: BorderRadius.circular(size * 0.28)),
      alignment: Alignment.center,
      child: Icon(icon, color: color, size: size * 0.5),
    );
  }
}

/// Same idea, for an already-rendered glyph (a project's emoji icon) rather
/// than a Material [IconData] — a colored circle behind the emoji instead of
/// a rounded square, since an emoji already carries its own shape/color.
class EmojiBadge extends StatelessWidget {
  final String emoji;
  final Color color;
  final double size;

  const EmojiBadge({super.key, required this.emoji, required this.color, this.size = 40});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: color.withValues(alpha: 0.16), shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text(emoji, style: TextStyle(fontSize: size * 0.5)),
    );
  }
}
