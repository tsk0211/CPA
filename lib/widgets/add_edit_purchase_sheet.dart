import 'package:flutter/material.dart';

import '../api/api_exception.dart';
import '../models/purchase.dart';
import '../models/units.dart';
import '../offline/pending_purchase.dart';
import '../state/app_scope.dart';
import '../state/app_currency.dart';
import 'common/adaptive_sheet.dart';
import 'common/error_text.dart';
import 'common/form_error_text.dart';
import 'common/loading_button.dart';
import 'sheet_padding.dart';

/// Returns true if something changed (created, queued offline, or edited).
Future<bool?> showAddEditPurchaseSheet(
  BuildContext context, {
  required String projectId,
  required String projectName,
  Purchase? existing,
}) {
  return showAdaptiveSheet<bool>(
    context,
    builder: (context) => _AddEditPurchaseSheet(
      projectId: projectId,
      projectName: projectName,
      existing: existing,
    ),
  );
}

class _AddEditPurchaseSheet extends StatefulWidget {
  final String projectId;
  final String projectName;
  final Purchase? existing;
  const _AddEditPurchaseSheet({
    required this.projectId,
    required this.projectName,
    this.existing,
  });

  @override
  State<_AddEditPurchaseSheet> createState() => _AddEditPurchaseSheetState();
}

class _AddEditPurchaseSheetState extends State<_AddEditPurchaseSheet> {
  late final _amountController = TextEditingController(
    text: widget.existing?.amount.toStringAsFixed(2) ?? "",
  );
  late final _descriptionController = TextEditingController(
    text: widget.existing?.description ?? "",
  );
  late final _quantityController = TextEditingController(
    text: widget.existing?.quantity?.toString() ?? "",
  );
  late final _vendorController = TextEditingController(
    text: widget.existing?.vendor ?? "",
  );
  late final _categoryController = TextEditingController(
    text: widget.existing?.category ?? "",
  );
  late final _notesController = TextEditingController(
    text: widget.existing?.notes ?? "",
  );
  late String? _unit = widget.existing?.unit;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _amountController.dispose();
    _descriptionController.dispose();
    _quantityController.dispose();
    _vendorController.dispose();
    _categoryController.dispose();
    _notesController.dispose();
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

    double? quantity;
    if (_quantityController.text.trim().isNotEmpty) {
      quantity = double.tryParse(_quantityController.text);
      if (quantity == null || quantity <= 0) {
        setState(() => _error = "Quantity must be a positive number.");
        return;
      }
      if (_unit == null) {
        setState(() => _error = "Pick a unit for that quantity.");
        return;
      }
    } else if (_unit != null) {
      setState(
        () => _error = "Enter a quantity for that unit, or clear the unit.",
      );
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    final scope = AppScope.of(context);
    final vendor = _vendorController.text.trim().isEmpty
        ? null
        : _vendorController.text.trim();
    final category = _categoryController.text.trim().isEmpty
        ? null
        : _categoryController.text.trim();
    final notes = _notesController.text.trim().isEmpty
        ? null
        : _notesController.text.trim();

    try {
      if (widget.existing != null) {
        await scope.purchases.update(
          widget.existing!.id,
          amount: amount,
          description: _descriptionController.text.trim(),
          quantity: quantity,
          unit: _unit,
          vendor: vendor,
          category: category,
          notes: notes,
        );
      } else {
        await scope.purchases.create(
          projectId: widget.projectId,
          amount: amount,
          description: _descriptionController.text.trim(),
          idempotencyKey: PendingPurchase.newLocalId(),
          quantity: quantity,
          unit: _unit,
          vendor: vendor,
          category: category,
          notes: notes,
        );
      }
      if (mounted) Navigator.of(context).pop(true);
    } on NetworkUnavailableException {
      if (widget.existing != null) {
        // Edits require connectivity by design — only "add" is queueable.
        setState(() => _error = networkUnavailableMessage);
      } else {
        await scope.offlineQueue.add(
          PendingPurchase(
            localId: PendingPurchase.newLocalId(),
            projectId: widget.projectId,
            projectName: widget.projectName,
            amount: amount,
            description: _descriptionController.text.trim(),
            quantity: quantity,
            unit: _unit,
            vendor: vendor,
            category: category,
            notes: notes,
            createdAtLocal: DateTime.now(),
          ),
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                "Offline — saved locally, will sync automatically.",
              ),
            ),
          );
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
      padding: sheetPadding(context),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.existing == null ? "Add cash purchase" : "Edit purchase",
              style: Theme.of(context).textTheme.titleLarge,
            ),
            Text(
              widget.projectName,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _amountController,
              autofocus: true,
              decoration: InputDecoration(
                labelText: "Amount",
                prefixText: currencySymbol(),
              ),
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descriptionController,
              decoration: const InputDecoration(labelText: "What was it for?"),
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: TextField(
                    controller: _quantityController,
                    decoration: const InputDecoration(
                      labelText: "Quantity (optional)",
                    ),
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _unit,
                    decoration: const InputDecoration(labelText: "Unit"),
                    items: [
                      const DropdownMenuItem(value: null, child: Text("—")),
                      for (final u in units)
                        DropdownMenuItem(value: u, child: Text(u)),
                    ],
                    onChanged: (v) => setState(() => _unit = v),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _vendorController,
              decoration: const InputDecoration(labelText: "Vendor (optional)"),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _categoryController,
              decoration: const InputDecoration(
                labelText: "Category (optional)",
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _notesController,
              decoration: const InputDecoration(labelText: "Notes (optional)"),
              minLines: 1,
              maxLines: 3,
            ),
            FormErrorText(_error),
            const SizedBox(height: 16),
            LoadingFilledButton(
              loading: _submitting,
              onPressed: _submit,
              child: const Text("Save"),
            ),
          ],
        ),
      ),
    );
  }
}
