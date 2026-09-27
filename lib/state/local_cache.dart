import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/project.dart';
import '../models/user.dart';

/// Small local mirror of "what we last knew" — the user's own profile, plus
/// the first page of Projects/Team — so a returning user sees real-looking
/// content the instant the app opens instead of a blank/skeleton screen
/// while a fresh request is still in flight (or the server is cold-starting).
///
/// Deliberately narrow: this is a display cache for a handful of screens,
/// not a local database. It's overwritten wholesale on every successful live
/// fetch of that same data — never merged, never trusted as a source of
/// truth for anything the server would enforce.
class LocalCache {
  static const _userKey = "cpa_cached_user";
  static const _projectsKey = "cpa_cached_projects";
  static const _teamKey = "cpa_cached_team";

  Future<void> saveUser(AppUser user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(user.toJson()));
  }

  Future<AppUser?> loadUser() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_userKey);
    if (raw == null) return null;
    try {
      return AppUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      // Cache from an older, incompatible app version — treat as a miss
      // rather than crashing bootstrap over stale local data.
      return null;
    }
  }

  Future<void> saveProjects(List<Project> projects) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_projectsKey, jsonEncode(projects.map((p) => p.toJson()).toList()));
  }

  Future<List<Project>> loadProjects() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_projectsKey);
    if (raw == null) return [];
    try {
      return (jsonDecode(raw) as List).cast<Map<String, dynamic>>().map(Project.fromJson).toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> saveTeam(List<TeamMember> team) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_teamKey, jsonEncode(team.map((m) => m.toJson()).toList()));
  }

  Future<List<TeamMember>> loadTeam() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_teamKey);
    if (raw == null) return [];
    try {
      return (jsonDecode(raw) as List).cast<Map<String, dynamic>>().map(TeamMember.fromJson).toList();
    } catch (_) {
      return [];
    }
  }

  /// Called on logout and whenever a refresh token turns out to be dead —
  /// a session that no longer exists shouldn't leave a stale identity for
  /// the next bootstrap to pick up.
  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await Future.wait([prefs.remove(_userKey), prefs.remove(_projectsKey), prefs.remove(_teamKey)]);
  }
}
