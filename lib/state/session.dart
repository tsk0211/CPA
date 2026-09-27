import 'dart:async';

import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../models/server_status.dart';
import '../models/user.dart';
import 'local_cache.dart';

enum SessionStatus { loading, loggedOut, mustChangePassword, loggedIn }

class Session extends ChangeNotifier {
  final ApiClient client;
  final LocalCache cache;
  Session(this.client, this.cache) {
    client.onSessionExpired = () {
      _user = null;
      _status = SessionStatus.loggedOut;
      cache.clear();
      notifyListeners();
    };
  }

  SessionStatus _status = SessionStatus.loading;
  AppUser? _user;
  ServerStatus _serverStatus = ServerStatus.idle;

  SessionStatus get status => _status;
  AppUser? get user => _user;

  /// Only meaningful while `status == SessionStatus.loading` — drives the
  /// one remaining wait screen (no cached identity to show yet, see
  /// `bootstrap()`).
  ServerStatus get serverStatus => _serverStatus;

  /// Called once at app start. A returning user with a cached identity
  /// (the normal case after their first launch on this app version) is
  /// shown the app immediately from that cache — no network wait at all —
  /// while `_reconcileInBackground` quietly re-validates against the real
  /// server. Only a device with no cache yet (first launch post-update, or
  /// a fresh install) waits, and does so behind a visible "waking up the
  /// server" indicator rather than a bare spinner — see project memory:
  /// this used to just hang on a bare CircularProgressIndicator whenever
  /// the server needed to cold-start, since GET /me's 15s request timeout
  /// threw an uncaught TimeoutException that bootstrap() never handled.
  Future<void> bootstrap() async {
    await client.loadPersistedTokens();
    if (!client.isLoggedIn) {
      _status = SessionStatus.loggedOut;
      notifyListeners();
      return;
    }

    final cachedUser = await cache.loadUser();
    if (cachedUser != null) {
      _user = cachedUser;
      _status = cachedUser.mustChangePassword ? SessionStatus.mustChangePassword : SessionStatus.loggedIn;
      notifyListeners();
      unawaited(_reconcileInBackground());
      return;
    }

    await _waitForServerThenFetchMe();
  }

  // Retries a handful of times, spaced out, then gives up quietly — the
  // user is already in the app on cached data, and any real screen action
  // already shows its own proper error+Retry state if the server's still
  // unreachable when they actually do something.
  Future<void> _reconcileInBackground() async {
    const maxAttempts = 8; // ~2 minutes total at 15s apart
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) await Future.delayed(const Duration(seconds: 15));
      if (!await client.checkHealth()) continue;
      try {
        final json = await client.fetchMe();
        _user = AppUser.fromJson(json);
        await cache.saveUser(_user!);
        _status = _user!.mustChangePassword ? SessionStatus.mustChangePassword : SessionStatus.loggedIn;
        notifyListeners();
        return; // only a successful reconcile stops retrying
      } catch (_) {
        // A live server but a failed /me is worth retrying too — stay on
        // cached data for now and try again next iteration. A dead refresh
        // token is caught by the normal request pipeline via
        // onSessionExpired regardless of what happens here.
      }
    }
  }

  // No cached identity to fall back to (first launch on this app version,
  // or a fresh install with a leftover token) — genuinely nothing to show
  // yet, so this is the one path that waits, polling the same lightweight
  // /health endpoint Login's status light uses rather than hitting /me
  // directly and risking its 15s timeout during a cold start.
  Future<void> _waitForServerThenFetchMe() async {
    _serverStatus = ServerStatus.waking;
    notifyListeners();

    const maxAttempts = 30; // ~90s at 3s apart — generous for a Render cold start
    var live = false;
    for (var attempt = 0; attempt < maxAttempts && !live; attempt++) {
      live = await client.checkHealth();
      if (!live) await Future.delayed(const Duration(seconds: 3));
    }

    if (live) {
      _serverStatus = ServerStatus.live;
      notifyListeners();
    }

    try {
      final json = await client.fetchMe();
      _user = AppUser.fromJson(json);
      await cache.saveUser(_user!);
      _status = _user!.mustChangePassword ? SessionStatus.mustChangePassword : SessionStatus.loggedIn;
    } catch (_) {
      // Still unreachable after the wait, or a real auth error — there's
      // nothing cached to fall back to, so send them to Login rather than
      // stranding them on this screen indefinitely.
      _status = SessionStatus.loggedOut;
    }
    notifyListeners();
  }

  Future<void> login(String email, String password, {required bool rememberMe}) async {
    final json = await client.login(email, password, rememberMe: rememberMe);
    _user = AppUser.fromJson(json);
    await cache.saveUser(_user!);
    _status = _user!.mustChangePassword ? SessionStatus.mustChangePassword : SessionStatus.loggedIn;
    notifyListeners();
  }

  Future<void> changePassword(String current, String next) async {
    await client.changePassword(current, next);
    if (_user != null) {
      _user = AppUser(id: _user!.id, name: _user!.name, email: _user!.email, role: _user!.role, mustChangePassword: false);
      await cache.saveUser(_user!);
    }
    _status = SessionStatus.loggedIn;
    notifyListeners();
  }

  Future<void> logout() async {
    await client.logout();
    _user = null;
    _status = SessionStatus.loggedOut;
    await cache.clear();
    notifyListeners();
  }
}
