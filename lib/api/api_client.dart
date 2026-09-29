import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../config.dart';
import 'api_exception.dart';

/// Thin HTTP wrapper: owns the access/refresh tokens (persisted in secure
/// storage), attaches the bearer header, and transparently refreshes once
/// on a 401 before retrying — callers never see the token lifecycle at all,
/// they just call get/post/patch/delete and get JSON back (or an
/// ApiException/NetworkUnavailableException).
class ApiClient {
  final FlutterSecureStorage _storage;
  final http.Client _http;

  ApiClient({FlutterSecureStorage? storage, http.Client? httpClient})
      : _storage = storage ?? const FlutterSecureStorage(),
        _http = httpClient ?? http.Client();

  String? _accessToken;
  String? _refreshToken;

  /// Set by Session. Called when a refresh attempt fails (refresh token
  /// itself expired/revoked) — the one signal that means "stop retrying,
  /// send the user back to Login."
  void Function()? onSessionExpired;

  bool get isLoggedIn => _refreshToken != null;

  Future<void> loadPersistedTokens() async {
    _accessToken = await _storage.read(key: "cpa_access_token");
    _refreshToken = await _storage.read(key: "cpa_refresh_token");
  }

  Future<void> _persistTokens(String access, String refresh) async {
    _accessToken = access;
    _refreshToken = refresh;
    await _storage.write(key: "cpa_access_token", value: access);
    await _storage.write(key: "cpa_refresh_token", value: refresh);
  }

  Future<void> _clearTokens() async {
    _accessToken = null;
    _refreshToken = null;
    await _storage.delete(key: "cpa_access_token");
    await _storage.delete(key: "cpa_refresh_token");
  }

  Future<Map<String, dynamic>> login(String email, String password, {required bool rememberMe}) async {
    final res = await _send("POST", "/auth/login", body: {"email": email, "password": password, "rememberMe": rememberMe}, auth: false);
    final json = _decode(res);
    await _persistTokens(json["accessToken"] as String, json["refreshToken"] as String);
    return json["user"] as Map<String, dynamic>;
  }

  Future<void> logout() async {
    if (_refreshToken != null) {
      try {
        await _send("POST", "/auth/logout", body: {"refreshToken": _refreshToken});
      } catch (_) {
        // Best-effort — clear local session regardless of whether the
        // server call succeeded (e.g. already offline).
      }
    }
    await _clearTokens();
  }

  Future<Map<String, dynamic>> fetchMe() => get("/auth/me");

  Future<void> changePassword(String currentPassword, String newPassword) async {
    await _send("POST", "/auth/change-password", body: {"currentPassword": currentPassword, "newPassword": newPassword});
  }

  Future<bool> _refresh() async {
    if (_refreshToken == null) return false;
    try {
      final res = await _send("POST", "/auth/refresh", body: {"refreshToken": _refreshToken}, auth: false);
      if (res.statusCode != 200) {
        await _clearTokens();
        return false;
      }
      final json = _decode(res);
      await _persistTokens(json["accessToken"] as String, json["refreshToken"] as String);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Unauthenticated, short-timeout ping at GET /health — for the Login
  /// screen's status light, not the normal request pipeline (no token
  /// header, no 401-refresh-retry, and it never throws: a down/unreachable/
  /// still-booting server is just `false`, which is exactly what a polling
  /// loop wants to act on).
  Future<bool> checkHealth() async {
    try {
      final res = await _http.get(Uri.parse("$apiBaseUrl/health")).timeout(const Duration(seconds: 5));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<Map<String, dynamic>> get(String path, {Map<String, String>? query}) async => _decode(await _send("GET", path, query: query));

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async => _decode(await _send("POST", path, body: body));

  Future<Map<String, dynamic>> patch(String path, Map<String, dynamic> body) async => _decode(await _send("PATCH", path, body: body));

  Future<void> delete(String path) async {
    await _send("DELETE", path);
  }

  /// For CSV/XLSX export downloads — returns raw bytes plus the filename
  /// the server suggested, rather than trying to JSON-decode a spreadsheet.
  Future<(List<int> bytes, String filename)> getBytes(String path, {Map<String, String>? query}) async {
    final res = await _send("GET", path, query: query);
    if (res.statusCode >= 400) throw _apiExceptionFrom(res);

    final disposition = res.headers["content-disposition"] ?? "";
    final match = RegExp(r'filename="([^"]+)"').firstMatch(disposition);
    final filename = match?.group(1) ?? "export";
    return (res.bodyBytes, filename);
  }

  Future<http.Response> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
    bool auth = true,
  }) async {
    Future<http.Response> attempt() async {
      final uri = Uri.parse("$apiBaseUrl$path").replace(queryParameters: query);
      final headers = {
        "Content-Type": "application/json",
        if (auth && _accessToken != null) "Authorization": "Bearer $_accessToken",
      };

      try {
        switch (method) {
          case "GET":
            return await _http.get(uri, headers: headers).timeout(const Duration(seconds: 15));
          case "POST":
            return await _http.post(uri, headers: headers, body: jsonEncode(body ?? {})).timeout(const Duration(seconds: 15));
          case "PATCH":
            return await _http.patch(uri, headers: headers, body: jsonEncode(body ?? {})).timeout(const Duration(seconds: 15));
          case "DELETE":
            return await _http.delete(uri, headers: headers).timeout(const Duration(seconds: 15));
          default:
            throw ArgumentError("unsupported method $method");
        }
      } on http.ClientException {
        // Thrown by package:http on a connection failure (host unreachable,
        // refused, DNS failure, …) on every platform including web — where
        // dart:io's SocketException/HttpException don't exist at all, so
        // this is the one exception type safe to catch cross-platform.
        throw NetworkUnavailableException();
      }
    }

    var res = await attempt();

    // One transparent refresh-and-retry on an expired access token. Skip
    // for the auth endpoints themselves to avoid a refresh loop.
    if (res.statusCode == 401 && auth && path != "/auth/refresh" && path != "/auth/login") {
      final refreshed = await _refresh();
      if (!refreshed) {
        onSessionExpired?.call();
        throw ApiException(401, "session expired, please log in again");
      }
      res = await attempt();
    }

    if (res.statusCode >= 400) throw _apiExceptionFrom(res);
    return res;
  }

  Map<String, dynamic> _decode(http.Response res) {
    if (res.body.isEmpty) return {};
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  ApiException _apiExceptionFrom(http.Response res) {
    try {
      final json = jsonDecode(res.body) as Map<String, dynamic>;
      return ApiException(res.statusCode, json["error"] as String? ?? "request failed", code: json["code"] as String?);
    } catch (_) {
      return ApiException(res.statusCode, "request failed (${res.statusCode})");
    }
  }
}
