import 'package:flutter/material.dart';

import '../../widgets/breakpoints.dart';

// Verified live, freely-licensed (public domain / CC BY-SA 4.0) photos from
// Wikimedia Commons — placeholders until Mauli Industries supplies their
// own photography. Credited in the footer per their licenses.
const _heroImage = "https://upload.wikimedia.org/wikipedia/commons/f/f9/Flickr_-_Official_U.S._Navy_Imagery_-_Sailor_shapes_a_valve_in_the_USS_Abraham_Lincoln_machine_shop..jpg";
const _repairImage = "https://upload.wikimedia.org/wikipedia/commons/c/c4/Welding_Robot.jpg";
const _modificationImage = "https://upload.wikimedia.org/wikipedia/commons/9/97/Tsugami_CNC_Lathe.jpg";

/// The public marketing site (web/desktop-browser build only — see
/// main.dart's kIsWeb branch). One scrollable page, nav bar jumps to the
/// About Us anchor; "Login" hands off to the actual app.
class MauliHomePage extends StatefulWidget {
  final VoidCallback onLogin;
  const MauliHomePage({super.key, required this.onLogin});

  @override
  State<MauliHomePage> createState() => _MauliHomePageState();
}

class _MauliHomePageState extends State<MauliHomePage> {
  final _scrollController = ScrollController();
  final _aboutKey = GlobalKey();

  void _scrollToAbout() {
    final ctx = _aboutKey.currentContext;
    if (ctx != null) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 500), curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final wide = isDesktop(context);
    return Scaffold(
      body: SingleChildScrollView(
        controller: _scrollController,
        child: Column(
          children: [
            _NavBar(wide: wide, onAboutTap: _scrollToAbout, onLogin: widget.onLogin),
            _Hero(wide: wide, onLogin: widget.onLogin),
            _ServicesSection(wide: wide),
            _AboutSection(key: _aboutKey, wide: wide),
            const _Footer(),
          ],
        ),
      ),
    );
  }
}

class _NavBar extends StatelessWidget {
  final bool wide;
  final VoidCallback onAboutTap;
  final VoidCallback onLogin;
  const _NavBar({required this.wide, required this.onAboutTap, required this.onLogin});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: wide ? 48 : 16, vertical: 16),
      decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 8)]),
      child: Row(
        children: [
          Icon(Icons.precision_manufacturing, color: Theme.of(context).colorScheme.primary, size: 28),
          const SizedBox(width: 10),
          Text("Mauli Industries", style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
          const Spacer(),
          TextButton(onPressed: () {}, child: const Text("Home")),
          TextButton(onPressed: onAboutTap, child: const Text("About Us")),
          const SizedBox(width: 8),
          FilledButton(onPressed: onLogin, child: const Text("Login")),
        ],
      ),
    );
  }
}

class _Hero extends StatefulWidget {
  final bool wide;
  final VoidCallback onLogin;
  const _Hero({required this.wide, required this.onLogin});

  @override
  State<_Hero> createState() => _HeroState();
}

class _HeroState extends State<_Hero> with SingleTickerProviderStateMixin {
  late final _floatController = AnimationController(vsync: this, duration: const Duration(seconds: 3))..repeat(reverse: true);

  @override
  void dispose() {
    _floatController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = _Reveal(
      delay: Duration.zero,
      child: Column(
        crossAxisAlignment: widget.wide ? CrossAxisAlignment.start : CrossAxisAlignment.center,
        children: [
          Text(
            "Keeping your plant running.",
            textAlign: widget.wide ? TextAlign.left : TextAlign.center,
            style: Theme.of(context).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: widget.wide ? 460 : 500),
            child: Text(
              "Mauli Industries provides on-site machine modification, repair, and preventive maintenance "
              "for local factories and plants — minimizing downtime and keeping production lines moving.",
              textAlign: widget.wide ? TextAlign.left : TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
          ),
          const SizedBox(height: 24),
          FilledButton.icon(onPressed: widget.onLogin, icon: const Icon(Icons.login), label: const Text("Team Login")),
        ],
      ),
    );

    final image = _Reveal(
      delay: const Duration(milliseconds: 150),
      child: AnimatedBuilder(
        animation: _floatController,
        builder: (context, child) => Transform.translate(offset: Offset(0, -6 + 6 * _floatController.value), child: child),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: Image.network(
            _heroImage,
            height: 320,
            fit: BoxFit.cover,
            loadingBuilder: (context, child, progress) => progress == null ? child : const SizedBox(height: 320, child: Center(child: CircularProgressIndicator())),
            errorBuilder: (context, error, stack) => Container(
              height: 320,
              color: scheme.surfaceContainerHighest,
              child: const Center(child: Icon(Icons.precision_manufacturing, size: 64)),
            ),
          ),
        ),
      ),
    );

    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(horizontal: widget.wide ? 48 : 20, vertical: widget.wide ? 72 : 48),
      decoration: BoxDecoration(gradient: LinearGradient(colors: [scheme.primaryContainer.withValues(alpha: 0.4), scheme.surface], begin: Alignment.topLeft, end: Alignment.bottomRight)),
      child: widget.wide
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(child: text),
                const SizedBox(width: 48),
                Expanded(child: image),
              ],
            )
          : Column(children: [text, const SizedBox(height: 32), image]),
    );
  }
}

class _ServicesSection extends StatelessWidget {
  final bool wide;
  const _ServicesSection({required this.wide});

  static const _services = [
    (Icons.build_circle_outlined, "Modification", "Retrofits and upgrades to existing machinery — adapting equipment to new production needs without a full replacement."),
    (Icons.handyman_outlined, "Repair", "Fast-response breakdown repair to get a stopped line moving again, from mechanical faults to electrical failures."),
    (Icons.event_available_outlined, "Maintenance", "Scheduled preventive maintenance plans that catch wear before it becomes downtime."),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(horizontal: wide ? 48 : 20, vertical: 56),
      child: Column(
        children: [
          _Reveal(child: Text("What we do", style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold))),
          const SizedBox(height: 32),
          Wrap(
            spacing: 24,
            runSpacing: 24,
            alignment: WrapAlignment.center,
            children: [
              for (var i = 0; i < _services.length; i++)
                _Reveal(
                  delay: Duration(milliseconds: 120 * i),
                  child: SizedBox(
                    width: wide ? 320 : 340,
                    child: Card(
                      elevation: 0,
                      color: Theme.of(context).colorScheme.surfaceContainerLow,
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(_services[i].$1, size: 36, color: Theme.of(context).colorScheme.primary),
                            const SizedBox(height: 12),
                            Text(_services[i].$2, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                            const SizedBox(height: 8),
                            Text(_services[i].$3, style: Theme.of(context).textTheme.bodyMedium),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 40),
          _Reveal(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: Image.network(
                _repairImage,
                height: 260,
                width: double.infinity,
                fit: BoxFit.cover,
                loadingBuilder: (context, child, progress) => progress == null ? child : SizedBox(height: 260, child: Center(child: CircularProgressIndicator())),
                errorBuilder: (context, error, stack) => Container(height: 260, color: Theme.of(context).colorScheme.surfaceContainerHighest),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AboutSection extends StatelessWidget {
  final bool wide;
  const _AboutSection({super.key, required this.wide});

  @override
  Widget build(BuildContext context) {
    final image = _Reveal(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Image.network(
          _modificationImage,
          height: 300,
          fit: BoxFit.cover,
          loadingBuilder: (context, child, progress) => progress == null ? child : const SizedBox(height: 300, child: Center(child: CircularProgressIndicator())),
          errorBuilder: (context, error, stack) => Container(height: 300, color: Theme.of(context).colorScheme.surfaceContainerHighest),
        ),
      ),
    );

    final text = _Reveal(
      delay: const Duration(milliseconds: 150),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("About Us", style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          Text(
            // Placeholder copy — swap for Mauli Industries' real history/mission once provided.
            "Mauli Industries is a service-based engineering company supporting local factories and plants "
            "with machine modification, repair, and maintenance. Our technicians work directly on-site, "
            "helping production teams keep their equipment running safely and efficiently for the long run.\n\n"
            "We partner with plant managers to plan maintenance around production schedules — not the other "
            "way around — so downtime stays a planned event, not an emergency.",
            style: Theme.of(context).textTheme.bodyLarge,
          ),
        ],
      ),
    );

    return Container(
      width: double.infinity,
      color: Theme.of(context).colorScheme.surfaceContainerLowest,
      padding: EdgeInsets.symmetric(horizontal: wide ? 48 : 20, vertical: 56),
      child: wide
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(child: image),
                const SizedBox(width: 48),
                Expanded(child: text),
              ],
            )
          : Column(children: [image, const SizedBox(height: 32), text]),
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: Theme.of(context).colorScheme.inverseSurface,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      child: Column(
        children: [
          Text(
            "© ${DateTime.now().year} Mauli Industries. All rights reserved.",
            style: TextStyle(color: Theme.of(context).colorScheme.onInverseSurface),
          ),
          const SizedBox(height: 4),
          Text(
            "Photos: U.S. Navy Imagery (public domain); \"Welding Robot\" and \"Tsugami CNC Lathe\", Wikimedia Commons, CC BY-SA 4.0 — placeholders pending Mauli Industries' own photography.",
            textAlign: TextAlign.center,
            style: TextStyle(color: Theme.of(context).colorScheme.onInverseSurface.withValues(alpha: 0.7), fontSize: 11),
          ),
        ],
      ),
    );
  }
}

/// Fade + slide-up entrance, played once on first build. No scroll-position
/// tracking (would need an extra package) — everything above the fold
/// reveals immediately, everything below reveals already-in-place by the
/// time a normal scroll speed reaches it, so it still reads as "arriving."
class _Reveal extends StatefulWidget {
  final Widget child;
  final Duration delay;
  const _Reveal({required this.child, this.delay = Duration.zero});

  @override
  State<_Reveal> createState() => _RevealState();
}

class _RevealState extends State<_Reveal> with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 500));

  @override
  void initState() {
    super.initState();
    Future.delayed(widget.delay, () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final curved = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    return AnimatedBuilder(
      animation: curved,
      builder: (context, child) => Opacity(
        opacity: curved.value,
        child: Transform.translate(offset: Offset(0, (1 - curved.value) * 24), child: child),
      ),
      child: widget.child,
    );
  }
}
