import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../api/api_exception.dart';
import '../models/project.dart';
import '../state/app_scope.dart';
import '../widgets/project_multi_select_sheet.dart';
import '../widgets/responsive_center.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

enum _DatePreset { today, thisWeek, thisMonth, custom, all }

class _ReportsScreenState extends State<ReportsScreen> {
  _DatePreset _preset = _DatePreset.all;
  DateTimeRange? _customRange;
  final List<Project> _selectedProjects = [];
  String _format = "csv";
  bool _includeAuditTrail = false;
  bool _exporting = false;
  String? _error;

  (DateTime?, DateTime?) get _resolvedRange {
    final now = DateTime.now();
    switch (_preset) {
      case _DatePreset.today:
        return (DateTime(now.year, now.month, now.day), null);
      case _DatePreset.thisWeek:
        final start = now.subtract(Duration(days: now.weekday - 1));
        return (DateTime(start.year, start.month, start.day), null);
      case _DatePreset.thisMonth:
        return (DateTime(now.year, now.month, 1), null);
      case _DatePreset.custom:
        return (_customRange?.start, _customRange?.end);
      case _DatePreset.all:
        return (null, null);
    }
  }

  Future<void> _pickCustomRange() async {
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      initialDateRange: _customRange,
    );
    if (!mounted || range == null) return;
    setState(() {
      _customRange = range;
      _preset = _DatePreset.custom;
    });
  }

  Future<void> _pickProjects() async {
    final result = await showProjectMultiSelectSheet(context, initiallySelected: _selectedProjects);
    if (!mounted || result == null) return;
    setState(() {
      _selectedProjects
        ..clear()
        ..addAll(result);
    });
  }

  Future<void> _export() async {
    setState(() {
      _exporting = true;
      _error = null;
    });
    try {
      final (from, to) = _resolvedRange;
      final (bytes, filename) = await AppScope.of(context).purchases.export(
        format: _format,
        projectIds: _selectedProjects.map((p) => p.id).toList(),
        from: from,
        to: to,
        includeAuditTrail: _includeAuditTrail,
      );

      final dir = await getTemporaryDirectory();
      final file = File("${dir.path}/$filename");
      await file.writeAsBytes(bytes);
      await Share.shareXFiles([XFile(file.path)], text: "CPA export");
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } on NetworkUnavailableException {
      setState(() => _error = "Can't reach the server. Reports need a live connection.");
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat.yMMMd();
    final (from, to) = _resolvedRange;

    return Scaffold(
      appBar: AppBar(title: const Text("Reports")),
      body: ResponsiveCenter(
        child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text("Date range", style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              ChoiceChip(label: const Text("All time"), selected: _preset == _DatePreset.all, onSelected: (_) => setState(() => _preset = _DatePreset.all)),
              ChoiceChip(label: const Text("Today"), selected: _preset == _DatePreset.today, onSelected: (_) => setState(() => _preset = _DatePreset.today)),
              ChoiceChip(label: const Text("This week"), selected: _preset == _DatePreset.thisWeek, onSelected: (_) => setState(() => _preset = _DatePreset.thisWeek)),
              ChoiceChip(label: const Text("This month"), selected: _preset == _DatePreset.thisMonth, onSelected: (_) => setState(() => _preset = _DatePreset.thisMonth)),
              ActionChip(
                label: Text(_preset == _DatePreset.custom && _customRange != null
                    ? "${dateFormat.format(_customRange!.start)} – ${dateFormat.format(_customRange!.end)}"
                    : "Custom…"),
                onPressed: _pickCustomRange,
              ),
            ],
          ),
          if (from != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text("From ${dateFormat.format(from)}${to != null ? ' to ${dateFormat.format(to)}' : ''}", style: Theme.of(context).textTheme.bodySmall)),
          const SizedBox(height: 20),
          Text("Projects", style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _pickProjects,
            icon: const Icon(Icons.search),
            label: Text(_selectedProjects.isEmpty ? "All projects" : "${_selectedProjects.length} project(s) selected"),
          ),
          const SizedBox(height: 20),
          Text("Format", style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: "csv", label: Text("CSV")),
              ButtonSegment(value: "xlsx", label: Text("Excel (.xlsx)")),
            ],
            selected: {_format},
            onSelectionChanged: (s) => setState(() => _format = s.first),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text("Include audit trail sheet"),
            subtitle: const Text("Who changed what, for this scope — Excel only"),
            value: _format == "xlsx" && _includeAuditTrail,
            onChanged: _format == "xlsx" ? (v) => setState(() => _includeAuditTrail = v) : null,
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _exporting ? null : _export,
            icon: _exporting ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.ios_share),
            label: const Text("Export"),
          ),
        ],
        ),
      ),
    );
  }
}
