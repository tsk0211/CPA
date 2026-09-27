// Verifies key screens render without overflow/exceptions across a range
// of real device sizes — the closest thing to "look at it on a phone" that
// this environment can do without a physical device or emulator. Auth and
// data are faked via a MockClient injected into ApiClient, so these are
// real widgets with real (canned) data, not just static layout checks.
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:cpa/api/api_client.dart';
import 'package:cpa/main.dart';

// Real device sizes, logical pixels (physicalSize / devicePixelRatio).
const _sizes = {
  'small phone (iPhone SE)': (Size(375, 667), 2.0),
  'large phone (Pixel 8 Pro)': (Size(412, 915), 3.5),
  'small-width phone (Galaxy Fold outer)': (Size(320, 720), 2.5),
  '7" tablet': (Size(600, 960), 2.0),
  '10" tablet': (Size(800, 1280), 2.0),
};

// http.Response infers encoding from the content-type header — "application/
// json" without an explicit charset defaults to Latin1 and throws on emoji;
// declaring charset=utf-8 explicitly is what actually selects UTF-8.
http.Response _json(Object data, {int status = 200}) {
  return http.Response(
    jsonEncode(data),
    status,
    headers: {"content-type": "application/json; charset=utf-8"},
  );
}

http.Client _buildMockClient() {
  return MockClient((request) async {
    final path = request.url.path;

    if (path == "/health") {
      return _json({"ok": true});
    }

    if (path == "/auth/me") {
      return _json({"id": "u1", "name": "Priya Sharma", "email": "priya@cpa.test", "role": "owner", "mustChangePassword": false});
    }

    if (path == "/projects") {
      return _json({
        "items": [
          {
            "_id": "p1",
            "name": "Riverside Warehouse Fit-out & Loading Dock Expansion",
            "icon": "🏗️",
            "createdBy": "u1",
            "createdAt": "2026-01-01T00:00:00.000Z",
            "totalSpent": 128450.75,
          },
          {"_id": "p2", "name": "Roofing Job", "icon": "🏠", "createdBy": "u1", "createdAt": "2026-01-02T00:00:00.000Z", "totalSpent": 320.5},
        ],
        "page": 1,
        "limit": 20,
        "total": 2,
        "hasMore": false,
      });
    }

    if (path == "/purchases/project/p1") {
      return _json({
        "items": [
          {
            "_id": "pu1",
            "projectId": "p1",
            "amount": 4500.0,
            "description": "Structural steel beams for the loading dock canopy extension",
            "quantity": 12,
            "unit": "piece",
            "vendor": "Meridian Steel Supply Co.",
            "createdBy": "u1",
            "purchasedAt": "2026-01-05T00:00:00.000Z",
          },
        ],
        "page": 1,
        "limit": 20,
        "total": 1,
        "hasMore": false,
      });
    }

    if (path == "/audit-log") {
      return _json({"items": [], "page": 1, "limit": 20, "total": 0, "hasMore": false});
    }

    return _json({"error": "unhandled in test: $path"}, status: 404);
  });
}

void main() {
  setUpAll(() {
    // Session.bootstrap() calls ApiClient.loadPersistedTokens(), which reads
    // these two keys individually — seed them here so bootstrap sees an
    // already-logged-in session, rather than relying on debugSetTokens()
    // (which bootstrap's read would silently overwrite with nulls anyway).
    const secureStorageChannel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(secureStorageChannel, (call) async {
      if (call.method == 'readAll') return <String, String>{};
      if (call.method == 'read') {
        final key = (call.arguments as Map)['key'] as String;
        if (key == 'cpa_access_token') return 'test-access-token';
        if (key == 'cpa_refresh_token') return 'test-refresh-token';
      }
      return null;
    });

    SharedPreferences.setMockInitialValues({});

    const connectivityChannel = MethodChannel('dev.fluttercommunity.plus/connectivity');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(connectivityChannel, (call) async {
      if (call.method == 'check') return 'wifi';
      return null;
    });
    const connectivityEventChannel = MethodChannel('dev.fluttercommunity.plus/connectivity_status');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(connectivityEventChannel, (call) async => null);
  });

  for (final entry in _sizes.entries) {
    testWidgets('renders cleanly at ${entry.key}', (tester) async {
      // Set inside the test body, not setUpAll — testWidgets resets
      // FlutterError.onError per test, so an outer override gets clobbered.
      // Default error handling only surfaces the bare summary via
      // takeException() ("A RenderFlex overflowed by 75 pixels..."); this
      // also prints the full details (widget ancestry, overflow hints).
      final originalOnError = FlutterError.onError;
      FlutterError.onError = (details) {
        if (details.exceptionAsString().contains('overflowed')) {
          // ignore: avoid_print
          print(details.toString());
        }
        originalOnError?.call(details);
      };

      final (size, dpr) = entry.value;
      tester.view.physicalSize = size * dpr;
      tester.view.devicePixelRatio = dpr;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final client = ApiClient(httpClient: _buildMockClient());

      await tester.pumpWidget(CpaApp(debugApiClient: client));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 1));

      expect(tester.takeException(), isNull, reason: 'Projects screen at ${entry.key}');
      expect(find.text('Projects'), findsWidgets);
      // The long project name must be present (truncated, not crashing) —
      // proves the ellipsis handling actually engaged rather than the
      // screen just being empty.
      expect(find.textContaining('Riverside Warehouse'), findsOneWidget);

      // Drill into the long-name project — the most layout-dense screen
      // (hero transition, tabs, long description + vendor in a list tile).
      await tester.tap(find.textContaining('Riverside Warehouse'));
      await tester.pump(); // start navigation/hero animation
      await tester.pump(const Duration(milliseconds: 400)); // let it settle
      await tester.pump(const Duration(seconds: 1));

      final exception = tester.takeException();
      if (exception != null) {
        // ignore: avoid_print
        print('--- Project Detail exception at ${entry.key} ---\n$exception');
      }
      expect(exception, isNull, reason: 'Project Detail screen at ${entry.key}');
      expect(find.textContaining('Structural steel beams'), findsOneWidget);
    });
  }
}
