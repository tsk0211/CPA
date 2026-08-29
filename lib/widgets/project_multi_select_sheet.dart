import 'dart:async';

import 'package:flutter/material.dart';

import '../models/project.dart';
import '../state/app_scope.dart';

Future<List<Project>?> showProjectMultiSelectSheet(BuildContext context, {required List<Project> initiallySelected}) {
  return showModalBottomSheet<List<Project>>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _ProjectMultiSelectSheet(initiallySelected: initiallySelected),
  );
}

class _ProjectMultiSelectSheet extends StatefulWidget {
  final List<Project> initiallySelected;
  const _ProjectMultiSelectSheet({required this.initiallySelected});

  @override
  State<_ProjectMultiSelectSheet> createState() => _ProjectMultiSelectSheetState();
}

class _ProjectMultiSelectSheetState extends State<_ProjectMultiSelectSheet> {
  late final Map<String, Project> _selected = {for (final p in widget.initiallySelected) p.id: p};
  final _searchController = TextEditingController();
  Timer? _debounce;
  List<Project> _items = [];
  bool _loading = true;
  bool _bootstrapped = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // AppScope.of(context) isn't valid in initState — didChangeDependencies
    // is the correct hook, guarded to fire only once.
    if (!_bootstrapped) {
      _bootstrapped = true;
      _load("");
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load(String search) async {
    setState(() => _loading = true);
    final result = await AppScope.of(context).projects.list(page: 1, limit: 50, search: search);
    if (!mounted) return;
    setState(() {
      _items = result.items;
      _loading = false;
    });
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () => _load(value));
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      expand: false,
      builder: (context, scrollController) {
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            children: [
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(child: Text("Select projects", style: Theme.of(context).textTheme.titleLarge)),
                  TextButton(onPressed: () => Navigator.of(context).pop(_selected.values.toList()), child: const Text("Done")),
                ],
              ),
              TextField(
                controller: _searchController,
                decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: "Search projects…"),
                onChanged: _onSearchChanged,
              ),
              if (_selected.isNotEmpty)
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton(onPressed: () => setState(_selected.clear), child: const Text("Clear selection")),
                ),
              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator())
                    : ListView.builder(
                        controller: scrollController,
                        itemCount: _items.length,
                        itemBuilder: (context, index) {
                          final project = _items[index];
                          final isSelected = _selected.containsKey(project.id);
                          return CheckboxListTile(
                            value: isSelected,
                            onChanged: (v) => setState(() {
                              if (v == true) {
                                _selected[project.id] = project;
                              } else {
                                _selected.remove(project.id);
                              }
                            }),
                            secondary: Text(project.icon),
                            title: Text(project.name),
                          );
                        },
                      ),
              ),
            ],
          ),
        );
      },
    );
  }
}
