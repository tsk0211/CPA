import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/project.dart';
import '../state/app_scope.dart';
import 'common/adaptive_sheet.dart';
import 'common/confirm_dialog.dart';
import 'common/loading_button.dart';
import 'emoji_picker_grid.dart';
import 'sheet_padding.dart';

/// Returns (name, icon, autoApproveThreshold) if saved, null if cancelled.
/// autoApproveThreshold is null for a new project (server defaults it to 0)
/// — the field only shows once a project exists to edit.
Future<(String, String, double?)?> showAddEditProjectSheet(BuildContext context, {Project? existing}) {
  return showAdaptiveSheet<(String, String, double?)>(
    context,
    builder: (context) => _AddEditProjectSheet(existing: existing),
  );
}

class _AddEditProjectSheet extends StatefulWidget {
  final Project? existing;
  const _AddEditProjectSheet({this.existing});

  @override
  State<_AddEditProjectSheet> createState() => _AddEditProjectSheetState();
}

class _AddEditProjectSheetState extends State<_AddEditProjectSheet> {
  late final _nameController = TextEditingController(text: widget.existing?.name ?? "");
  late final _thresholdController = TextEditingController(
    text: widget.existing != null ? widget.existing!.autoApproveThreshold.toStringAsFixed(2) : "",
  );
  late String _icon = widget.existing?.icon ?? "📁";
  String? _nameError;
  bool _saving = false;

  @override
  void dispose() {
    _nameController.dispose();
    _thresholdController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_nameController.text.trim().isEmpty) {
      setState(() => _nameError = "Project name is required.");
      return;
    }

    final existing = widget.existing;
    final threshold = existing == null ? null : double.tryParse(_thresholdController.text.trim()) ?? 0;

    if (existing != null && threshold != null && threshold != existing.autoApproveThreshold) {
      setState(() => _saving = true);
      try {
        final (count, totalAmount) = await AppScope.of(context).projects.autoApproveThresholdPreview(existing.id, threshold);
        if (!mounted) return;
        if (count > 0) {
          final currency = NumberFormat.simpleCurrency();
          final confirmed = await confirmAction(
            context,
            title: "Approve $count pending purchase${count == 1 ? '' : 's'}?",
            message: "Changing the auto-approve threshold to ${currency.format(threshold)} will immediately approve "
                "$count pending purchase${count == 1 ? '' : 's'} totaling ${currency.format(totalAmount)}, "
                "since ${count == 1 ? 'it is' : 'they are'} now at or under the new threshold.",
            confirmLabel: "Change & approve",
          );
          if (!confirmed) {
            if (mounted) setState(() => _saving = false);
            return;
          }
        }
      } catch (_) {
        // Best-effort preview only — a failure here (e.g. offline) shouldn't
        // block the rest of the edit. The server applies the exact same
        // rule on save regardless of whether this preview succeeded.
      }
      if (mounted) setState(() => _saving = false);
    }

    if (!mounted) return;
    Navigator.of(context).pop((_nameController.text.trim(), _icon, threshold));
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: sheetPadding(context),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.existing == null ? "New project" : "Edit project", style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), color: Theme.of(context).colorScheme.surfaceContainerHighest),
                child: Text(_icon, style: const TextStyle(fontSize: 24)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _nameController,
                  autofocus: true,
                  decoration: InputDecoration(labelText: "Project name", errorText: _nameError),
                  onChanged: (_) {
                    if (_nameError != null) setState(() => _nameError = null);
                  },
                  onSubmitted: (_) => _save(),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          EmojiPickerGrid(selected: _icon, onSelected: (e) => setState(() => _icon = e)),
          if (widget.existing != null) ...[
            const SizedBox(height: 16),
            TextField(
              controller: _thresholdController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: "Auto-approve under",
                helperText: "A member's purchase at or under this amount skips review. 0 = always review.",
                prefixText: "₹ ",
              ),
            ),
          ],
          const SizedBox(height: 16),
          LoadingFilledButton(loading: _saving, onPressed: _save, child: const Text("Save")),
        ],
      ),
    );
  }
}
