import 'dart:async';

import 'package:flutter/material.dart';

import '../api/api_exception.dart';
import '../state/app_scope.dart';
import '../widgets/server_status_light.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _rememberMe = false;
  bool _submitting = false;
  String? _error;

  ServerStatus _serverStatus = ServerStatus.idle;
  Timer? _healthPoll;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _healthPoll?.cancel();
    super.dispose();
  }

  // Render's free tier cold-starts after 15 minutes idle — the first hit
  // can take anywhere from a few seconds to ~a minute to come back up.
  // "Start" fires one immediate check, then polls every 3s until it
  // succeeds; the button itself only works once (see ServerStatusLight),
  // so this never runs two overlapping loops.
  Future<void> _start() async {
    setState(() => _serverStatus = ServerStatus.waking);
    await _pollOnce();
    _healthPoll = Timer.periodic(const Duration(seconds: 3), (_) => _pollOnce());
  }

  Future<void> _pollOnce() async {
    final alive = await AppScope.of(context).client.checkHealth();
    if (!mounted) return;
    if (alive) {
      _healthPoll?.cancel();
      setState(() => _serverStatus = ServerStatus.live);
    }
  }

  Future<void> _submit() async {
    if (_emailController.text.trim().isEmpty || _passwordController.text.isEmpty) {
      setState(() => _error = "Enter your email and password.");
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await AppScope.of(context).session.login(_emailController.text.trim(), _passwordController.text, rememberMe: _rememberMe);
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
    final formEnabled = _serverStatus == ServerStatus.live;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 380),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text("CPA", style: Theme.of(context).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text("Cash Purchase Accounting", style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 24),
                  ServerStatusLight(status: _serverStatus, onStart: _start),
                  const SizedBox(height: 24),
                  TextField(
                    controller: _emailController,
                    enabled: formEnabled,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    decoration: const InputDecoration(labelText: "Email"),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _passwordController,
                    enabled: formEnabled,
                    obscureText: true,
                    autofillHints: const [AutofillHints.password],
                    decoration: const InputDecoration(labelText: "Password"),
                    onSubmitted: (_) => formEnabled ? _submit() : null,
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    value: _rememberMe,
                    onChanged: formEnabled ? (v) => setState(() => _rememberMe = v ?? false) : null,
                    title: const Text("Remember me on this device"),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 4),
                    Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ],
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: (!formEnabled || _submitting) ? null : _submit,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: _submitting
                          ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Text("Log in"),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    "Accounts are created by your Owner or Admin — there's no self-signup.",
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall,
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
