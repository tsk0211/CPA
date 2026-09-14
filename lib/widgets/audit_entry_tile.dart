import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/audit_entry.dart';
import 'detail_row.dart';

const _actionLabels = {
  "project.create": "created project",
  "project.rename": "edited project",
  "project.delete": "deleted project",
  "purchase.create": "logged a purchase",
  "purchase.edit": "edited a purchase",
  "purchase.delete": "deleted a purchase",
  "purchase.approve": "approved a purchase",
  "purchase.reject": "rejected a purchase",
  "user.create": "created an account",
  "user.role_change": "changed a role",
  "user.deactivate": "deactivated an account",
};

class AuditEntryTile extends StatelessWidget {
  final AuditEntry entry;
  const AuditEntryTile({super.key, required this.entry});

  @override
  Widget build(BuildContext context) {
    final label = _actionLabels[entry.action] ?? entry.action;
    final hasDiff = entry.before != null || entry.after != null;

    return ListTile(
      leading: CircleAvatar(child: Text(entry.actorName.isNotEmpty ? entry.actorName[0].toUpperCase() : "?")),
      title: RichText(
        text: TextSpan(
          style: DefaultTextStyle.of(context).style,
          children: [
            TextSpan(text: entry.actorName, style: const TextStyle(fontWeight: FontWeight.bold)),
            TextSpan(text: " $label"),
          ],
        ),
      ),
      subtitle: Text(DateFormat.yMMMEd().add_jm().format(entry.createdAt)),
      trailing: hasDiff ? const Icon(Icons.chevron_right) : null,
      onTap: hasDiff ? () => _showDetails(context, label) : null,
    );
  }

  // A dedicated, view-only dialog reads far better than cramming
  // before/after fields into an inline-expanding tile — each field gets its
  // own line instead of one long comma-joined string.
  void _showDetails(BuildContext context, String label) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text("${entry.actorName} $label"),
        content: SizedBox(
          width: double.maxFinite,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(DateFormat.yMMMEd().add_jm().format(entry.createdAt), style: Theme.of(dialogContext).textTheme.bodySmall),
                if (entry.before != null) ...[
                  const SizedBox(height: 16),
                  _DiffSection(label: "Before", data: entry.before!),
                ],
                if (entry.after != null) ...[
                  const SizedBox(height: 16),
                  _DiffSection(label: "After", data: entry.after!),
                ],
              ],
            ),
          ),
        ),
        actions: [TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text("Close"))],
      ),
    );
  }
}

class _DiffSection extends StatelessWidget {
  final String label;
  final Map<String, dynamic> data;
  const _DiffSection({required this.label, required this.data});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        for (final e in data.entries) DetailRow(label: e.key, value: "${e.value}"),
      ],
    );
  }
}
