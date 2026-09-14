import 'package:flutter/material.dart';

/// Shared by the Review queue and Project Detail's inline review actions —
/// rejecting a purchase always requires a reason (the server enforces this
/// too), so both call sites collect it the same way.
Future<String?> askRejectionReason(BuildContext context, String purchaseDescription) {
  final controller = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text('Reject "$purchaseDescription"?'),
      content: TextField(
        controller: controller,
        autofocus: true,
        decoration: const InputDecoration(labelText: "Reason", hintText: "e.g. no matching receipt"),
        maxLines: 2,
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text("Cancel")),
        FilledButton(
          onPressed: () => Navigator.pop(dialogContext, controller.text.trim().isEmpty ? null : controller.text.trim()),
          child: const Text("Reject"),
        ),
      ],
    ),
  );
}
