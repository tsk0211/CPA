import 'package:flutter/material.dart';

import 'loading_indicator.dart';

/// A full-width [FilledButton] that shows an inline spinner in place of its
/// label while `loading`, and disables itself so a slow tap-happy user can't
/// fire the action twice. Replaces the `_submitting ? CircularProgressIndicator(...) :
/// Text(...)` ternary duplicated in every add/edit sheet.
///
/// Explicitly full-width (not relying on the theme's button minimumSize) —
/// this is meant for a form's single primary submit action (Login, Save,
/// Create), which should always span the form's width regardless of what
/// the shared button theme's default sizing is elsewhere.
class LoadingFilledButton extends StatelessWidget {
  final bool loading;
  final VoidCallback? onPressed;
  final Widget child;

  const LoadingFilledButton({super.key, required this.loading, required this.onPressed, required this.child});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton(
        onPressed: loading ? null : onPressed,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: loading ? InlineSpinner(color: Theme.of(context).colorScheme.onPrimary) : child,
        ),
      ),
    );
  }
}

/// Sibling of [LoadingFilledButton] for secondary actions that use an
/// [OutlinedButton] instead — see its doc comment for why full width is
/// explicit here rather than inherited from the button theme.
class LoadingOutlinedButton extends StatelessWidget {
  final bool loading;
  final VoidCallback? onPressed;
  final Widget child;

  const LoadingOutlinedButton({super.key, required this.loading, required this.onPressed, required this.child});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton(
        onPressed: loading ? null : onPressed,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: loading ? const InlineSpinner() : child,
        ),
      ),
    );
  }
}
