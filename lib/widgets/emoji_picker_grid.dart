import 'package:flutter/material.dart';

const _curatedEmojis = [
  "📁", "🏗️", "🏠", "🏢", "🏭", "🛠️", "🚧", "🧱",
  "🚗", "🚚", "⛽", "🔧", "🔩", "⚡", "🪵", "🧰",
  "📦", "🧾", "💰", "💵", "📊", "📈", "🗂️", "📌",
  "🌾", "🏡", "🛣️", "🌉", "🏘️", "🧑‍🔧", "🎯", "✅",
];

class EmojiPickerGrid extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onSelected;
  const EmojiPickerGrid({super.key, required this.selected, required this.onSelected});

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 8,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        for (final emoji in _curatedEmojis)
          InkWell(
            borderRadius: BorderRadius.circular(8),
            onTap: () => onSelected(emoji),
            child: Container(
              margin: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: emoji == selected ? Theme.of(context).colorScheme.primaryContainer : null,
              ),
              alignment: Alignment.center,
              child: Text(emoji, style: const TextStyle(fontSize: 22)),
            ),
          ),
      ],
    );
  }
}
