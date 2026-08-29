import 'package:flutter/widgets.dart';

import '../api/api_client.dart';
import '../api/audit_api.dart';
import '../api/projects_api.dart';
import '../api/purchases_api.dart';
import '../api/users_api.dart';
import '../offline/offline_queue.dart';
import 'session.dart';

/// Simple hand-rolled dependency scope — one ApiClient and its typed
/// resource wrappers, the Session, and the offline queue, all reachable
/// via AppScope.of(context) without pulling in a state-management package
/// for what's ultimately a handful of singletons.
class AppScope extends InheritedWidget {
  final Session session;
  final ApiClient client;
  final ProjectsApi projects;
  final PurchasesApi purchases;
  final UsersApi users;
  final AuditApi auditLog;
  final OfflineQueue offlineQueue;

  const AppScope({
    super.key,
    required this.session,
    required this.client,
    required this.projects,
    required this.purchases,
    required this.users,
    required this.auditLog,
    required this.offlineQueue,
    required super.child,
  });

  static AppScope of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, "AppScope.of() called with no AppScope ancestor");
    return scope!;
  }

  @override
  bool updateShouldNotify(AppScope oldWidget) => false;
}
