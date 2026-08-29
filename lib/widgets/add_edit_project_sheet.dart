import 'package:flutter/material.dart';

import '../models/project.dart';
import 'emoji_picker_grid.dart';

/// Returns (name, icon) if saved, null if cancelled.
Future<(String, String)?> showAddEditProjectSheet(BuildContext context, {Project? existing}) {
  return showModalBottomSheet<(String, String)>(
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
  late String _icon = widget.existing?.icon ?? "📁";

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  void _save() {
    if (_nameController.text.trim().isEmpty) return;
    Navigator.of(context).pop((_nameController.text.trim(), _icon));
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: MediaQuery.of(context).viewInsets.bottom + 16),
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
          const SizedBox(height: 16),
          FilledButton(onPressed: _save, child: const Padding(padding: EdgeInsets.symmetric(vertical: 10), child: Text("Save"))),
        ],
      ),
    );
  }
}
