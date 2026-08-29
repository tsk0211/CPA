import 'package:flutter/material.dart';

import '../api/api_exception.dart';
import '../models/purchase.dart';
import '../offline/pending_purchase.dart';
import '../state/app_scope.dart';

/// Returns true if something changed (created, queued offline, or edited).
Future<bool?> showAddEditPurchaseSheet(
  BuildContext context, {
  required String projectId,
  required String projectName,
  Purchase? existing,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _AddEditPurchaseSheet(projectId: projectId, projectName: projectName, existing: existing),
  );
}

class _AddEditPurchaseSheet extends StatefulWidget {
  final String projectId;
  final String projectName;
  final Purchase? existing;
  const _AddEditPurchaseSheet({required this.projectId, required this.projectName, this.existing});

  @override
  State<_AddEditPurchaseSheet> createState() => _AddEditPurchaseSheetState();
}

class _AddEditPurchaseSheetState extends State<_AddEditPurchaseSheet> {
  late final _amountController = TextEditingController(text: widget.existing?.amount.toStringAsFixed(2) ?? "");
  late final _descriptionController = TextEditingController(text: widget.existing?.description ?? "");
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _amountController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final amount = double.tryParse(_amountController.text);
    if (amount == null || amount <= 0) {
      setState(() => _error = "Enter a valid amount.");
      return;
    }
    if (_descriptionController.text.trim().isEmpty) {
      setState(() => _error = "Enter what it was for.");
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    final scope = AppScope.of(context);
    try {
      if (widget.existing != null) {
        await scope.purchases.update(widget.existing!.id, amount: amount, description: _descriptionController.text.trim());
      } else {
        await scope.purchases.create(projectId: widget.projectId, amount: amount, description: _descriptionController.text.trim());
      }
      if (mounted) Navigator.of(context).pop(true);
    } on NetworkUnavailableException {
      if (widget.existing != null) {
        // Edits require connectivity by design — only "add" is queueable.
        setState(() => _error = "Can't reach the server to save this edit. Try again once you're back online.");
      } else {
        await scope.offlineQueue.add(PendingPurchase(
          localId: PendingPurchase.newLocalId(),
          projectId: widget.projectId,
          projectName: widget.projectName,
          amount: amount,
          description: _descriptionController.text.trim(),
          createdAtLocal: DateTime.now(),
        ));
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Offline — saved locally, will sync automatically.")));
          Navigator.of(context).pop(true);
        }
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: MediaQuery.of(context).viewInsets.bottom + 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.existing == null ? "Add cash purchase" : "Edit purchase", style: Theme.of(context).textTheme.titleLarge),
          Text(widget.projectName, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 16),
          TextField(
            controller: _amountController,
            autofocus: true,
            decoration: const InputDecoration(labelText: "Amount", prefixText: "\$ "),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _descriptionController,
            decoration: const InputDecoration(labelText: "What was it for?"),
            onSubmitted: (_) => _submit(),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: _submitting ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text("Save"),
            ),
          ),
        ],
      ),
    );
  }
}
