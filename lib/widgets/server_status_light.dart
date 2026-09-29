import 'package:flutter/material.dart';

import '../models/server_status.dart';

export '../models/server_status.dart';

/// Traffic-light indicator + "Start" button for the Login screen. Render is
/// dumb (color/label from `status`); LoginScreen owns the actual polling
/// loop and just feeds this widget its current status.
class ServerStatusLight extends StatefulWidget {
  final ServerStatus status;
  final VoidCallback onStart;
  const ServerStatusLight({super.key, required this.status, required this.onStart});

  @override
  State<ServerStatusLight> createState() => _ServerStatusLightState();
}

class _ServerStatusLightState extends State<ServerStatusLight> with SingleTickerProviderStateMixin {
  late final _pulseController = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat(reverse: true);

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  Color get _color {
    switch (widget.status) {
      case ServerStatus.idle:
        return Colors.red;
      case ServerStatus.waking:
        return Colors.amber;
      case ServerStatus.live:
        return Colors.green;
    }
  }

  String get _label {
    switch (widget.status) {
      case ServerStatus.idle:
        return "Server not checked yet";
      case ServerStatus.waking:
        return "Waking up the server…";
      case ServerStatus.live:
        return "Server is live";
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        AnimatedBuilder(
          animation: _pulseController,
          builder: (context, _) {
            // Only the "waking" light actually pulses — idle (red) and live
            // (green) are steady states, nothing left to indicate.
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
        const SizedBox(height: 8),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 250),
          child: Text(_label, key: ValueKey(_label), style: Theme.of(context).textTheme.bodySmall),
        ),
        const SizedBox(height: 16),
        // Disabled the instant it's pressed once (status leaves idle) — a
        // second tap would just start a redundant polling loop.
        FilledButton.icon(
          onPressed: widget.status == ServerStatus.idle ? widget.onStart : null,
          icon: widget.status == ServerStatus.live
              ? const Icon(Icons.check_circle_outline)
              : widget.status == ServerStatus.waking
                  ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.play_arrow),
          label: Text(widget.status == ServerStatus.live ? "Ready" : "Start"),
        ),
      ],
    );
  }
}
