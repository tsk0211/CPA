import 'package:flutter/material.dart';

import '../login_screen.dart';
import 'mauli_home_page.dart';

/// Web-only gate in front of Login (see main.dart's kIsWeb branch): shows
/// the public Mauli Industries site (Home + About Us) until "Login" is
/// tapped, then swaps to the real LoginScreen. Going back to the site from
/// Login is intentionally not offered — nothing on Login depends on it and
/// a stray "back to home" control would just be one more way to abandon a
/// login that's mid server-wake.
class PublicSiteShell extends StatefulWidget {
  const PublicSiteShell({super.key});

  @override
  State<PublicSiteShell> createState() => _PublicSiteShellState();
}

class _PublicSiteShellState extends State<PublicSiteShell> {
  bool _showLogin = false;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 250),
      child: _showLogin ? const LoginScreen(key: ValueKey("login")) : MauliHomePage(key: const ValueKey("home"), onLogin: () => setState(() => _showLogin = true)),
    );
  }
}
