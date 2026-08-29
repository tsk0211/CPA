import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

import 'models.dart';

class AppDatabase {
  AppDatabase._();
  static final AppDatabase instance = AppDatabase._();

  Database? _db;

  Future<Database> get database async {
    _db ??= await _open();
    return _db!;
  }

  Future<Database> _open() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'cpa.db');
    return openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            description TEXT NOT NULL,
            purchased_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
          )
        ''');
      },
    );
  }

  Future<Project> createProject(String name) async {
    final db = await database;
    final id = await db.insert('projects', {
      'name': name,
      'created_at': DateTime.now().toIso8601String(),
    });
    return Project(id: id, name: name, createdAt: DateTime.now());
  }

  Future<List<Project>> listProjects() async {
    final db = await database;
    final rows = await db.query('projects', orderBy: 'name');
    return rows.map(Project.fromMap).toList();
  }

  Future<void> deleteProject(int id) async {
    final db = await database;
    await db.delete('purchases', where: 'project_id = ?', whereArgs: [id]);
    await db.delete('projects', where: 'id = ?', whereArgs: [id]);
  }

  Future<Purchase> addPurchase({
    required int projectId,
    required double amount,
    required String description,
  }) async {
    final db = await database;
    final now = DateTime.now();
    final id = await db.insert('purchases', {
      'project_id': projectId,
      'amount': amount,
      'description': description,
      'purchased_at': now.toIso8601String(),
    });
    return Purchase(id: id, projectId: projectId, amount: amount, description: description, purchasedAt: now);
  }

  Future<void> deletePurchase(int id) async {
    final db = await database;
    await db.delete('purchases', where: 'id = ?', whereArgs: [id]);
  }

  Future<List<Purchase>> purchasesForProject(int projectId) async {
    final db = await database;
    final rows = await db.query(
      'purchases',
      where: 'project_id = ?',
      whereArgs: [projectId],
      orderBy: 'purchased_at DESC',
    );
    return rows.map(Purchase.fromMap).toList();
  }

  Future<List<Purchase>> purchasesOnDay(DateTime day) async {
    final db = await database;
    final start = DateTime(day.year, day.month, day.day);
    final end = start.add(const Duration(days: 1));
    final rows = await db.query(
      'purchases',
      where: 'purchased_at >= ? AND purchased_at < ?',
      whereArgs: [start.toIso8601String(), end.toIso8601String()],
      orderBy: 'purchased_at DESC',
    );
    return rows.map(Purchase.fromMap).toList();
  }
}
