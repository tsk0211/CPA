import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/audit_entry.dart';

const _actionLabels = {
  "project.create": "created project",
  "project.rename": "edited project",
  "project.delete": "deleted project",
  "purchase.create": "logged a purchase",
  "purchase.edit": "edited a purchase",
  "purchase.delete": "deleted a purchase",
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

    return ExpansionTile(
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
      children: hasDiff
          ? [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (entry.before != null) _DiffRow(label: "Before", data: entry.before!),
                    if (entry.after != null) _DiffRow(label: "After", data: entry.after!),
                  ],
                ),
              ),
            ]
          : const [],
    );
  }
}

class _DiffRow extends StatelessWidget {
  final String label;
  final Map<String, dynamic> data;
  const _DiffRow({required this.label, required this.data});

  @override
  Widget build(BuildContext context) {
    final text = data.entries.map((e) => "${e.key}: ${e.value}").join(", ");
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Text("$label — $text", style: Theme.of(context).textTheme.bodySmall),
    );
  }
}
