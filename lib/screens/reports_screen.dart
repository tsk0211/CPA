import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';

import '../api/api_exception.dart';
import '../models/project.dart';
import '../models/purchase.dart';
import '../state/app_scope.dart';
import '../widgets/breakpoints.dart';
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
  String? _exportError;
  String? _previewError;

  final List<Purchase> _previewItems = [];
  int _previewPage = 1;
  bool _previewHasMore = false;
  bool _previewLoading = false;
  bool _previewLoaded = false;
  double _previewTotalAmount = 0;
  bool _bootstrapped = false;
  // Bumped on every _loadPreview call so a response from a filter the user
  // has since changed away from (or a "Load more" that was in flight when
  // a filter reset the list) is discarded instead of overwriting newer state.
  int _previewRequestId = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_bootstrapped) {
      _bootstrapped = true;
      _loadPreview();
    }
  }

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
    _loadPreview();
  }

  Future<void> _pickProjects() async {
    final result = await showProjectMultiSelectSheet(context, initiallySelected: _selectedProjects);
    if (!mounted || result == null) return;
    setState(() {
      _selectedProjects
        ..clear()
        ..addAll(result);
    });
    _loadPreview();
  }

  void _setPreset(_DatePreset preset) {
    setState(() => _preset = preset);
    _loadPreview();
  }

  Future<void> _loadPreview({bool reset = true}) async {
    final requestId = ++_previewRequestId;
    setState(() {
      _previewLoading = true;
      _previewError = null;
    });
    try {
      final (from, to) = _resolvedRange;
      final (paged, totalAmount) = await AppScope.of(context).purchases.search(
        page: reset ? 1 : _previewPage + 1,
        projectIds: _selectedProjects.map((p) => p.id).toList(),
        from: from,
        to: to,
      );
      if (!mounted || requestId != _previewRequestId) return;
      setState(() {
        if (reset) {
          _previewItems
            ..clear()
            ..addAll(paged.items);
          _previewPage = 1;
        } else {
          _previewItems.addAll(paged.items);
          _previewPage += 1;
        }
        _previewHasMore = paged.hasMore;
        _previewTotalAmount = totalAmount;
        _previewLoaded = true;
      });
    } on ApiException catch (e) {
      if (!mounted || requestId != _previewRequestId) return;
      setState(() => _previewError = e.message);
    } on NetworkUnavailableException {
      if (!mounted || requestId != _previewRequestId) return;
      setState(() => _previewError = "Can't reach the server. Reports need a live connection.");
    } finally {
      if (mounted && requestId == _previewRequestId) setState(() => _previewLoading = false);
    }
  }

  Future<void> _export() async {
    setState(() {
      _exporting = true;
      _exportError = null;
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

      // XFile.fromData (not a real File path) — works on every platform,
      // including web where there's no filesystem to write a temp file to.
      final mimeType = _format == "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv";
      await Share.shareXFiles([XFile.fromData(Uint8List.fromList(bytes), name: filename, mimeType: mimeType)], text: "CPA export");
    } on ApiException catch (e) {
      setState(() => _exportError = e.message);
    } on NetworkUnavailableException {
      setState(() => _exportError = "Can't reach the server. Reports need a live connection.");
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat.yMMMd();
    final currency = NumberFormat.simpleCurrency();
    final (from, to) = _resolvedRange;

    return Scaffold(
      appBar: AppBar(title: const Text("Reports")),
      body: ResponsiveCenter(
        maxWidth: isDesktop(context) ? 900 : 720,
        child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text("Date range", style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              ChoiceChip(label: const Text("All time"), selected: _preset == _DatePreset.all, onSelected: (_) => _setPreset(_DatePreset.all)),
              ChoiceChip(label: const Text("Today"), selected: _preset == _DatePreset.today, onSelected: (_) => _setPreset(_DatePreset.today)),
              ChoiceChip(label: const Text("This week"), selected: _preset == _DatePreset.thisWeek, onSelected: (_) => _setPreset(_DatePreset.thisWeek)),
              ChoiceChip(label: const Text("This month"), selected: _preset == _DatePreset.thisMonth, onSelected: (_) => _setPreset(_DatePreset.thisMonth)),
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text("Preview", style: Theme.of(context).textTheme.titleSmall),
              if (_previewLoaded) Text(currency.format(_previewTotalAmount), style: Theme.of(context).textTheme.titleSmall),
            ],
          ),
          const SizedBox(height: 8),
          if (_previewError != null) ...[
            Text(_previewError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            const SizedBox(height: 8),
          ],
          if (_previewLoading && _previewItems.isEmpty)
            const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()))
          else if (_previewLoaded && _previewItems.isEmpty)
            const Padding(padding: EdgeInsets.all(16), child: Center(child: Text("No purchases match these filters.")))
          else
            for (final p in _previewItems)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: p.projectIcon != null ? Text(p.projectIcon!, style: const TextStyle(fontSize: 20)) : null,
                title: Text(p.description, maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text(
                  [if (p.projectName != null) p.projectName!, dateFormat.format(p.purchasedAt)].join(" · "),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing: Text(currency.format(p.amount)),
              ),
          if (_previewHasMore)
            Center(
              child: TextButton(
                onPressed: _previewLoading ? null : () => _loadPreview(reset: false),
                child: _previewLoading
                    ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text("Load more"),
              ),
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
          if (_exportError != null) ...[
            const SizedBox(height: 8),
            Text(_exportError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
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
