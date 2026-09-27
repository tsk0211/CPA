import 'package:flutter/material.dart';

import '../models/project.dart';
import 'emoji_picker_grid.dart';
import 'sheet_padding.dart';

/// Returns (name, icon, autoApproveThreshold) if saved, null if cancelled.
/// autoApproveThreshold is null for a new project (server defaults it to 0)
/// — the field only shows once a project exists to edit.
Future<(String, String, double?)?> showAddEditProjectSheet(BuildContext context, {Project? existing}) {
  return showModalBottomSheet<(String, String, double?)>(
    context: context,
    isScrollControlled: true,
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

  @override
  void dispose() {
    _nameController.dispose();
    _thresholdController.dispose();
    super.dispose();
  }

  void _save() {
    if (_nameController.text.trim().isEmpty) return;
    final threshold = widget.existing == null ? null : double.tryParse(_thresholdController.text.trim()) ?? 0;
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
                  decoration: const InputDecoration(labelText: "Project name"),
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
          FilledButton(onPressed: _save, child: const Padding(padding: EdgeInsets.symmetric(vertical: 10), child: Text("Save"))),
        ],
      ),
    );
  }
}
