import 'package:flutter/material.dart';

import 'screens/home_shell.dart';

void main() {
  runApp(const CpaApp());
}

class CpaApp extends StatelessWidget {
  const CpaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CPA — Cash Purchase Accounting',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF2E7D32),
        useMaterial3: true,
      ),
      home: const HomeShell(),
    );
  }
}
