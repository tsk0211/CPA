import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
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
import 'screens/public/public_site_shell.dart';
import 'state/app_scope.dart';
import 'state/connectivity_status.dart';
import 'state/local_cache.dart';
import 'state/session.dart';
import 'theme.dart';
import 'widgets/server_waking_view.dart';

void main() {
  runApp(const CpaApp());
}

class CpaApp extends StatefulWidget {
  /// Test-only hook: pass a pre-configured ApiClient (mock http.Client,
  /// tokens seeded via debugSetTokens) to render authenticated screens
  /// with real widgets and fake network data, without a live server.
  final ApiClient? debugApiClient;
  const CpaApp({super.key, this.debugApiClient});

  @override
  State<CpaApp> createState() => _CpaAppState();
}

class _CpaAppState extends State<CpaApp> {
  late final ApiClient _client;
  late final LocalCache _cache;
  late final Session _session;
  late final ProjectsApi _projects;
  late final PurchasesApi _purchases;
  late final UsersApi _users;
  late final AuditApi _auditLog;
  late final OfflineQueue _offlineQueue;
  late final ConnectivityStatus _connectivity;

  @override
  void initState() {
    super.initState();
    _client = widget.debugApiClient ?? ApiClient();
    _cache = LocalCache();
    _session = Session(_client, _cache);
    _projects = ProjectsApi(_client);
    _purchases = PurchasesApi(_client);
    _users = UsersApi(_client);
    _auditLog = AuditApi(_client);
    _offlineQueue = OfflineQueue();
    _connectivity = ConnectivityStatus();

    _bootstrap();
    _connectivity.listen();
    // Whenever connectivity comes back, try to flush anything queued
    // offline. A failed sync just leaves items queued for next time.
    Connectivity().onConnectivityChanged.listen((results) {
      if (!results.contains(ConnectivityResult.none)) {
        _offlineQueue.sync(_purchases);
      }
    });
  }

  Future<void> _bootstrap() async {
    await _connectivity.load();
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
      cache: _cache,
      connectivity: _connectivity,
      child: MaterialApp(
        title: "CPA",
        debugShowCheckedModeBanner: false,
        theme: buildTheme(Brightness.light),
        darkTheme: buildTheme(Brightness.dark),
        themeMode: ThemeMode.system,
        home: AnimatedBuilder(
          animation: _session,
          builder: (context, _) {
            final Widget child;
            switch (_session.status) {
              case SessionStatus.loading:
                child = ServerWakingView(status: _session.serverStatus);
              case SessionStatus.loggedOut:
                // The public marketing site (Home/About Us) only exists on
                // the web build — the mobile app goes straight to Login as
                // it always has, no public storefront to show on a phone.
                child = kIsWeb ? const PublicSiteShell() : const LoginScreen();
              case SessionStatus.mustChangePassword:
                child = const ChangePasswordScreen(forced: true);
              case SessionStatus.loggedIn:
                child = const HomeShell();
            }
            return AnimatedSwitcher(
              duration: const Duration(milliseconds: 250),
              switchInCurve: Curves.easeOut,
              switchOutCurve: Curves.easeIn,
              child: KeyedSubtree(key: ValueKey(_session.status), child: child),
            );
          },
        ),
      ),
    );
  }
}
