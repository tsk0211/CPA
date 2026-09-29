// This app is deployed to GitHub Pages under a basePath (/CPA/CPA-next —
// see next.config.ts), which next/image's own automatic basePath
// prefixing doesn't reliably apply to its rendered `src` under
// `output: "export"` + `images.unoptimized` — the image just 404s at the
// unprefixed URL. NEXT_PUBLIC_BASE_PATH is the same basePath value,
// inlined at build time (next.config.ts's `env` option), so this is a
// build-time string concat, not a runtime lookup — reliable regardless of
// whatever next/image is or isn't doing.
export function assetPath(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${basePath}${path}`;
}
