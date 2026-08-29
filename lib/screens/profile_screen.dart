import 'package:flutter/material.dart';

import '../state/app_scope.dart';
import '../widgets/responsive_center.dart';
import '../widgets/role_badge.dart';
import 'change_password_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = AppScope.of(context).session.user!;

    return Scaffold(
      appBar: AppBar(title: const Text("Profile")),
      body: ResponsiveCenter(
        maxWidth: 480,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            CircleAvatar(
              radius: 32,
              child: Text(user.name.isNotEmpty ? user.name[0].toUpperCase() : "?", style: const TextStyle(fontSize: 24)),
            ),
            const SizedBox(height: 12),
            Text(
              user.name,
              style: Theme.of(context).textTheme.titleLarge,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              user.email,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 8),
            Center(child: RoleBadge(role: user.role)),
            const SizedBox(height: 24),
            ListTile(
              leading: const Icon(Icons.lock_outline),
              title: const Text("Change password"),
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ChangePasswordScreen(forced: false))),
            ),
            ListTile(
              leading: const Icon(Icons.logout),
              title: const Text("Log out"),
              onTap: () => AppScope.of(context).session.logout(),
            ),
          ],
        ),
      ),
    );
  }
}
