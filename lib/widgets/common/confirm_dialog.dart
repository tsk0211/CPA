import 'package:flutter/material.dart';

/// Whether a confirmation is for a destructive/irreversible action (delete,
/// deactivate, reject, sign out) or a regular one — controls the confirm
/// button's color so destructive actions read as different from routine
/// "Save"-style confirmations.
enum ConfirmDialogTone { neutral, destructive }

/// Shared confirm/cancel dialog. Returns `true` only if the user explicitly
/// tapped the confirm button — dismissing (back button, tap outside, Cancel)
/// all resolve to `false`, so call sites can just do
/// `if (await confirmAction(...)) { ... }`.
///
/// Sibling of `askRejectionReason` (reject_reason_dialog.dart), which uses
/// the same Future-returning `showDialog` shape but also collects text.
Future<bool> confirmAction(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = "Confirm",
  String cancelLabel = "Cancel",
  ConfirmDialogTone tone = ConfirmDialogTone.neutral,
}) async {
  final colorScheme = Theme.of(context).colorScheme;
  final result = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, false),
          child: Text(cancelLabel),
        ),
        FilledButton(
          style: tone == ConfirmDialogTone.destructive
              ? FilledButton.styleFrom(backgroundColor: colorScheme.error, foregroundColor: colorScheme.onError)
              : null,
          onPressed: () => Navigator.pop(dialogContext, true),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return result ?? false;
}
