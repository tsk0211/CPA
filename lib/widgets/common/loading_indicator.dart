import 'package:flutter/material.dart';

/// Full-page loading state — replaces bare `Center(child:
/// CircularProgressIndicator())` so every screen's first-load spinner looks
/// and behaves the same (and can carry an optional message).
class LoadingView extends StatelessWidget {
  final String? message;
  const LoadingView({super.key, this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          if (message != null) ...[
            const SizedBox(height: 16),
            Text(message!, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ],
      ),
    );
  }
}

/// Small inline spinner for in-button / in-row "this is busy" states — fixed
/// size so every button's spinner matches instead of each screen picking its
/// own width/strokeWidth.
class InlineSpinner extends StatelessWidget {
  final Color? color;
  const InlineSpinner({super.key, this.color});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 16,
      width: 16,
      child: CircularProgressIndicator(strokeWidth: 2, color: color),
    );
  }
}
