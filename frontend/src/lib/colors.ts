// Direct port of theme.dart's category palette / colorForKey — a
// deterministic color per project/person id so the same one always gets the
// same identity color everywhere it's shown (icon badges, avatars).
const CATEGORY_PALETTE = [
  "#3B82F6", // blue
  "#A855F7", // purple
  "#F97316", // orange
  "#14B8A6", // teal
  "#EC4899", // pink
  "#F59E0B", // amber
  "#6366F1", // indigo
  "#06B6D4", // cyan
];

export function colorForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length];
}
