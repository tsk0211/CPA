import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';

import 'api/api_client.dart';
import 'api/audit_api.dart';
import 'api/projects_api.dart';
import 'api/purchases_api.dart';
import 'api/users_api.dart';
import 'offline/offline_queue.dart';
import 'screens/change_password_screen.dart';
import 'screens/home_shell.dart';
import 'screens/login_screen.dart';
import 'state/app_scope.dart';
import 'state/session.dart';

void main() {
  runApp(const CpaApp());
}

class CpaApp extends StatefulWidget {
  const CpaApp({super.key});

  @override
  State<CpaApp> createState() => _CpaAppState();
}

class _CpaAppState extends State<CpaApp> {
  late final ApiClient _client;
  late final Session _session;
  late final ProjectsApi _projects;
  late final PurchasesApi _purchases;
  late final UsersApi _users;
  late final AuditApi _auditLog;
  late final OfflineQueue _offlineQueue;

  @override
  void initState() {
    super.initState();
    _client = ApiClient();
    _session = Session(_client);
    _projects = ProjectsApi(_client);
    _purchases = PurchasesApi(_client);
    _users = UsersApi(_client);
    _auditLog = AuditApi(_client);
    _offlineQueue = OfflineQueue();

    _bootstrap();
    // Whenever connectivity comes back, try to flush anything queued
    // offline. A failed sync just leaves items queued for next time.
    Connectivity().onConnectivityChanged.listen((results) {
      if (!results.contains(ConnectivityResult.none)) {
        _offlineQueue.sync(_purchases);
      }
    });
  }

  Future<void> _bootstrap() async {
    await _offlineQueue.load();
    await _session.bootstrap();
    if (_offlineQueue.hasPending) _offlineQueue.sync(_purchases);
  }

  @override
  Widget build(BuildContext context) {
    return AppScope(
      session: _session,
      client: _client,
      projects: _projects,
      purchases: _purchases,
      users: _users,
      auditLog: _auditLog,
      offlineQueue: _offlineQueue,
      child: MaterialApp(
        title: "CPA",
        debugShowCheckedModeBanner: false,
        theme: ThemeData(colorSchemeSeed: const Color(0xFF2E7D32), useMaterial3: true),
        home: AnimatedBuilder(
          animation: _session,
          builder: (context, _) {
            switch (_session.status) {
              case SessionStatus.loading:
                return const Scaffold(body: Center(child: CircularProgressIndicator()));
              case SessionStatus.loggedOut:
                return const LoginScreen();
              case SessionStatus.mustChangePassword:
                return const ChangePasswordScreen(forced: true);
              case SessionStatus.loggedIn:
                return const HomeShell();
            }
          },
        ),
      ),
    );
  }
}
