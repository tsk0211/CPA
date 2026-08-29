import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:cpa/main.dart';

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  });

  testWidgets('app launches to the Today tab', (tester) async {
    await tester.pumpWidget(const CpaApp());
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('Today'), findsWidgets);
    expect(find.text('Projects'), findsOneWidget);
  });
}
