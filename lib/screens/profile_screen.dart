import 'package:flutter/material.dart';

import '../state/app_scope.dart';
import '../widgets/common/colored_avatar.dart';
import '../widgets/common/confirm_dialog.dart';
import '../widgets/responsive_center.dart';
import '../widgets/role_badge.dart';
import 'change_password_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  Future<void> _logout(BuildContext context) async {
    final confirmed = await confirmAction(
      context,
      title: "Log out?",
      message: "You'll need to sign in again to continue.",
      confirmLabel: "Log out",
      tone: ConfirmDialogTone.destructive,
    );
    if (confirmed && context.mounted) AppScope.of(context).session.logout();
  }

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
            Center(child: ColoredAvatar(name: user.name, radius: 32)),
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
            Card(
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.lock_outline),
                    title: const Text("Change password"),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ChangePasswordScreen(forced: false))),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: Icon(Icons.logout, color: Theme.of(context).colorScheme.error),
                    title: Text("Log out", style: TextStyle(color: Theme.of(context).colorScheme.error)),
                    onTap: () => _logout(context),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
