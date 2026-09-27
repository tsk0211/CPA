import 'package:flutter/material.dart';

import 'spacing.dart';

/// Consistent inline form-error display — an icon + the message in the
/// theme's error color, or nothing at all when there's no error. Replaces
/// the plain `Text(_error!, style: TextStyle(color: colorScheme.error))`
/// hand-rolled slightly differently in each add/edit sheet.
class FormErrorText extends StatelessWidget {
  final String? message;
  const FormErrorText(this.message, {super.key});

  @override
  Widget build(BuildContext context) {
    if (message == null || message!.isEmpty) return const SizedBox.shrink();
    final colorScheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(top: Spacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.error_outline, size: 16, color: colorScheme.error),
          const SizedBox(width: Spacing.xs),
          Expanded(
            child: Text(message!, style: TextStyle(color: colorScheme.error)),
          ),
        ],
      ),
    );
  }
}
