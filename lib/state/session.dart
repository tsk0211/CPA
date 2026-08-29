import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../models/user.dart';

enum SessionStatus { loading, loggedOut, mustChangePassword, loggedIn }

class Session extends ChangeNotifier {
  final ApiClient client;
  Session(this.client) {
    client.onSessionExpired = () {
      _user = null;
      _status = SessionStatus.loggedOut;
      notifyListeners();
    };
  }

  SessionStatus _status = SessionStatus.loading;
  AppUser? _user;

  SessionStatus get status => _status;
  AppUser? get user => _user;

  /// Called once at app start. If a refresh token is stored, re-validates
  /// against the server (GET /auth/me) rather than trusting whatever was
  /// last cached — a role change or deactivation while the app was closed
  /// should be reflected the moment it reopens.
  Future<void> bootstrap() async {
    await client.loadPersistedTokens();
    if (!client.isLoggedIn) {
      _status = SessionStatus.loggedOut;
      notifyListeners();
      return;
    }

    try {
      final json = await client.fetchMe();
      _user = AppUser.fromJson(json);
      _status = _user!.mustChangePassword ? SessionStatus.mustChangePassword : SessionStatus.loggedIn;
    } on ApiException {
      _status = SessionStatus.loggedOut;
    } on NetworkUnavailableException {
      // Offline at launch with a previously-valid session: let the user in
      // on faith rather than locking them out just because they can't
      // currently reach the server. mustChangePassword can't be known
      // offline, so assume false — the server will still enforce the gate
      // once reachable, this only affects the very first frame's routing.
      _status = SessionStatus.loggedIn;
    }
    notifyListeners();
  }

  Future<void> login(String email, String password, {required bool rememberMe}) async {
    final json = await client.login(email, password, rememberMe: rememberMe);
    _user = AppUser.fromJson(json);
    _status = _user!.mustChangePassword ? SessionStatus.mustChangePassword : SessionStatus.loggedIn;
    notifyListeners();
  }

  Future<void> changePassword(String current, String next) async {
    await client.changePassword(current, next);
    if (_user != null) {
      _user = AppUser(id: _user!.id, name: _user!.name, email: _user!.email, role: _user!.role, mustChangePassword: false);
    }
    _status = SessionStatus.loggedIn;
    notifyListeners();
  }

  Future<void> logout() async {
    await client.logout();
    _user = null;
    _status = SessionStatus.loggedOut;
    notifyListeners();
  }
}
