import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:cpa/db.dart';

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  });

  test('create project and add purchase', () async {
    final project = await AppDatabase.instance.createProject('Test Project');
    expect(project.id, isNotNull);

    final purchase = await AppDatabase.instance.addPurchase(
      projectId: project.id!,
      amount: 42.5,
      description: 'Nails',
    );
    expect(purchase.amount, 42.5);

    final purchases = await AppDatabase.instance.purchasesForProject(project.id!);
    expect(purchases.length, 1);
  });
}
