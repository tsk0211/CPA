import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

/// Live online/offline signal, shared app-wide via [AppScope] — for the
/// handful of screens (Team's user list + per-user activity) that show
/// data too sensitive/fast-changing to display from a stale local cache:
/// they gate themselves on [isOnline] instead of painting cached data and
/// only discovering the network is down once a request fails.
///
/// Distinct from [OfflineQueue]: that tracks *queued purchases* waiting to
/// sync; this just tracks "is there a network path right now."
class ConnectivityStatus extends ChangeNotifier {
  bool _isOnline = true;

  bool get isOnline => _isOnline;

  Future<void> load() async {
    final results = await Connectivity().checkConnectivity();
    _isOnline = !results.contains(ConnectivityResult.none);
    notifyListeners();
  }

  void listen() {
    Connectivity().onConnectivityChanged.listen((results) {
      final nowOnline = !results.contains(ConnectivityResult.none);
      if (nowOnline != _isOnline) {
        _isOnline = nowOnline;
        notifyListeners();
      }
    });
  }
}
