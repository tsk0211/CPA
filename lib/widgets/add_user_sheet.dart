import 'package:flutter/material.dart';

import '../api/api_exception.dart';
import '../models/role.dart';
import '../state/app_scope.dart';

/// Returns true if a new account was created.
Future<bool?> showAddUserSheet(BuildContext context, {required bool canCreateAdmin}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _AddUserSheet(canCreateAdmin: canCreateAdmin),
  );
}

class _AddUserSheet extends StatefulWidget {
  final bool canCreateAdmin;
  const _AddUserSheet({required this.canCreateAdmin});

  @override
  State<_AddUserSheet> createState() => _AddUserSheetState();
}

class _AddUserSheetState extends State<_AddUserSheet> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _tempPasswordController = TextEditingController();
  late Role _role = Role.member;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _tempPasswordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_nameController.text.trim().isEmpty || _emailController.text.trim().isEmpty || _tempPasswordController.text.length < 8) {
      setState(() => _error = "Fill in name, email, and a temp password of at least 8 characters.");
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await AppScope.of(context).users.create(
            name: _nameController.text.trim(),
            email: _emailController.text.trim(),
            tempPassword: _tempPasswordController.text,
            role: _role,
          );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } on NetworkUnavailableException {
      setState(() => _error = "Can't reach the server. Check your connection and try again.");
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final assignableRoles = [Role.member, Role.analyst, if (widget.canCreateAdmin) Role.admin];

    return Padding(
      padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: MediaQuery.of(context).viewInsets.bottom + 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text("New account", style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          TextField(controller: _nameController, decoration: const InputDecoration(labelText: "Name")),
          const SizedBox(height: 12),
          TextField(controller: _emailController, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: "Email")),
          const SizedBox(height: 12),
          TextField(
            controller: _tempPasswordController,
            decoration: const InputDecoration(labelText: "Temporary password", helperText: "Share this with them directly — they'll be forced to change it on first login"),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<Role>(
            initialValue: _role,
            decoration: const InputDecoration(labelText: "Role"),
            items: [for (final r in assignableRoles) DropdownMenuItem(value: r, child: Text(r.label))],
            onChanged: (r) => setState(() => _role = r ?? Role.member),
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
              child: _submitting ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text("Create"),
            ),
          ),
        ],
      ),
    );
  }
}
