import 'package:flutter/material.dart';

import 'loading_indicator.dart';

/// A [FilledButton] that shows an inline spinner in place of its label while
/// `loading`, and disables itself so a slow tap-happy user can't fire the
/// action twice. Replaces the `_submitting ? CircularProgressIndicator(...) :
/// Text(...)` ternary duplicated in every add/edit sheet.
class LoadingFilledButton extends StatelessWidget {
  final bool loading;
  final VoidCallback? onPressed;
  final Widget child;

  const LoadingFilledButton({super.key, required this.loading, required this.onPressed, required this.child});

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: loading ? null : onPressed,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: loading ? InlineSpinner(color: Theme.of(context).colorScheme.onPrimary) : child,
      ),
    );
  }
}

/// Sibling of [LoadingFilledButton] for secondary actions that use an
/// [OutlinedButton] instead.
class LoadingOutlinedButton extends StatelessWidget {
  final bool loading;
  final VoidCallback? onPressed;
  final Widget child;

  const LoadingOutlinedButton({super.key, required this.loading, required this.onPressed, required this.child});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: loading ? null : onPressed,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: loading ? const InlineSpinner() : child,
      ),
    );
  }
}
