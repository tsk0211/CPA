import 'package:flutter/material.dart';

import '../db.dart';
import '../models.dart';

/// Shows a bottom sheet to add a purchase. If [fixedProject] is given, the
/// project picker is skipped. Returns true if a purchase was added.
Future<bool?> showAddPurchaseSheet(
  BuildContext context, {
  required List<Project> projects,
  Project? fixedProject,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _AddPurchaseSheet(projects: projects, fixedProject: fixedProject),
  );
}

class _AddPurchaseSheet extends StatefulWidget {
  final List<Project> projects;
  final Project? fixedProject;

  const _AddPurchaseSheet({required this.projects, this.fixedProject});

  @override
  State<_AddPurchaseSheet> createState() => _AddPurchaseSheetState();
}

class _AddPurchaseSheetState extends State<_AddPurchaseSheet> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _descriptionController = TextEditingController();
  Project? _selectedProject;

  @override
  void initState() {
    super.initState();
    _selectedProject = widget.fixedProject ?? (widget.projects.isNotEmpty ? widget.projects.first : null);
  }

  @override
  void dispose() {
    _amountController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _selectedProject == null) return;
    await AppDatabase.instance.addPurchase(
      projectId: _selectedProject!.id!,
      amount: double.parse(_amountController.text),
      description: _descriptionController.text.trim(),
    );
    if (mounted) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Add cash purchase', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            if (widget.fixedProject == null)
              DropdownButtonFormField<Project>(
                initialValue: _selectedProject,
                decoration: const InputDecoration(labelText: 'Project'),
                items: widget.projects
                    .map((p) => DropdownMenuItem(value: p, child: Text(p.name)))
                    .toList(),
                onChanged: (p) => setState(() => _selectedProject = p),
                validator: (p) => p == null ? 'Pick a project' : null,
              )
            else
              InputDecorator(
                decoration: const InputDecoration(labelText: 'Project'),
                child: Text(widget.fixedProject!.name),
              ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _amountController,
              decoration: const InputDecoration(labelText: 'Amount', prefixText: '\$ '),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              validator: (v) {
                final parsed = double.tryParse(v ?? '');
                if (parsed == null || parsed <= 0) return 'Enter a valid amount';
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _descriptionController,
              decoration: const InputDecoration(labelText: 'What was it for?'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 20),
            FilledButton(onPressed: _submit, child: const Padding(
              padding: EdgeInsets.symmetric(vertical: 10),
              child: Text('Save'),
            )),
          ],
        ),
      ),
    );
  }
}
