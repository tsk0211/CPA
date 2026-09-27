import 'package:flutter/material.dart';

import '../api/api_exception.dart';
import '../state/app_scope.dart';
import '../widgets/common/error_text.dart';
import '../widgets/common/form_error_text.dart';
import '../widgets/common/loading_button.dart';

class ChangePasswordScreen extends StatefulWidget {
  final bool forced;
  const ChangePasswordScreen({super.key, required this.forced});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_newController.text.length < 8) {
      setState(() => _error = "New password must be at least 8 characters.");
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await AppScope.of(context).session.changePassword(_currentController.text, _newController.text);
      if (!widget.forced && mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } on NetworkUnavailableException {
      setState(() => _error = networkUnavailableMessage);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: widget.forced ? null : AppBar(title: const Text("Change password")),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 380),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (widget.forced) ...[
                    Text("Set your password", style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 4),
                    const Text("You're using a temporary password. Choose a new one to continue."),
                    const SizedBox(height: 24),
                  ],
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          TextField(
                            controller: _currentController,
                            obscureText: true,
                            decoration: InputDecoration(
                              labelText: widget.forced ? "Temporary password" : "Current password",
                              helperText: widget.forced ? "The one-time password you just logged in with" : null,
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _newController,
                            obscureText: true,
                            decoration: const InputDecoration(labelText: "New password", helperText: "At least 8 characters"),
                            onSubmitted: (_) => _submit(),
                          ),
                          FormErrorText(_error),
                          const SizedBox(height: 12),
                          LoadingFilledButton(loading: _submitting, onPressed: _submit, child: const Text("Save")),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
