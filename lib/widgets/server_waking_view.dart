import 'package:flutter/material.dart';

import '../models/server_status.dart';

/// The one remaining wait screen at app launch — shown only when there's no
/// cached identity to display yet (see Session.bootstrap()'s cache-miss
/// path). Same pulsing-dot visual language as Login's ServerStatusLight, but
/// driven automatically with no Start button: this is an unattended
/// app-launch flow, not a user-initiated one.
class ServerWakingView extends StatefulWidget {
  final ServerStatus status;
  const ServerWakingView({super.key, required this.status});

  @override
  State<ServerWakingView> createState() => _ServerWakingViewState();
}

class _ServerWakingViewState extends State<ServerWakingView> with SingleTickerProviderStateMixin {
  late final _pulseController = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat(reverse: true);

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  Color get _color => widget.status == ServerStatus.live ? Colors.green : Colors.amber;

  String get _label => widget.status == ServerStatus.live ? "Signing you in…" : "Waking up the server…";

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedBuilder(
                animation: _pulseController,
                builder: (context, _) {
                  final pulseScale = widget.status == ServerStatus.waking ? 1.0 + (_pulseController.value * 0.35) : 1.0;
                  final glowOpacity = widget.status == ServerStatus.waking ? 0.25 + (_pulseController.value * 0.35) : 0.35;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 400),
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _color,
                      boxShadow: [
                        BoxShadow(color: _color.withValues(alpha: glowOpacity), blurRadius: 10 * pulseScale, spreadRadius: 2 * pulseScale),
                      ],
                    ),
                  );
                },
              ),
              const SizedBox(height: 16),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: Text(_label, key: ValueKey(_label), style: Theme.of(context).textTheme.bodyMedium),
              ),
              const SizedBox(height: 8),
              Text(
                "This can take up to a minute the first time.",
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
