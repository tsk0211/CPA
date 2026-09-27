import 'package:flutter/material.dart';

import '../../theme.dart';

/// A `CircleAvatar` colored deterministically from [name] via
/// `colorForKey` — the same person always gets the same color everywhere,
/// instead of every avatar in the app being the same flat neutral circle.
class ColoredAvatar extends StatelessWidget {
  final String name;
  final double radius;

  const ColoredAvatar({super.key, required this.name, this.radius = 20});

  @override
  Widget build(BuildContext context) {
    final color = colorForKey(name);
    return CircleAvatar(
      radius: radius,
      backgroundColor: color.withValues(alpha: 0.22),
      child: Text(
        name.isNotEmpty ? name[0].toUpperCase() : "?",
        style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: radius * 0.85),
      ),
    );
  }
}
