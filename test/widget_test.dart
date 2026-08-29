import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:cpa/main.dart';

void main() {
  // Several plugins talk to platform channels with no test-time
  // implementation by default — stub each so app startup (Session
  // .bootstrap(), OfflineQueue.load(), the connectivity listener) resolves
  // cleanly instead of throwing MissingPluginException.
  setUpAll(() {
    const secureStorageChannel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(secureStorageChannel, (call) async {
      if (call.method == 'readAll') return <String, String>{};
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

  testWidgets('app with no saved session launches to the Login screen', (tester) async {
    await tester.pumpWidget(const CpaApp());
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('CPA'), findsOneWidget);
    expect(find.text('Log in'), findsOneWidget);
  });
}
