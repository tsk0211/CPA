import 'package:flutter/material.dart';

import '../models/role.dart';
import '../theme.dart';

/// A color-coded role chip — same accent per role everywhere it appears
/// (Team list, Profile), drawn from the active theme so it holds up in
/// both light and dark mode.
class RoleBadge extends StatelessWidget {
  final Role role;
  const RoleBadge({super.key, required this.role});

  @override
  Widget build(BuildContext context) {
    final color = roleColor(context, role);
    return Chip(
      label: Text(role.label),
      labelStyle: TextStyle(color: color, fontWeight: FontWeight.w600),
      backgroundColor: color.withValues(alpha: 0.12),
      side: BorderSide(color: color.withValues(alpha: 0.4)),
    );
  }
}
