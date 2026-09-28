import type { NextConfig } from "next";

// Static export: this app is 100% client-side data fetching against the
// existing Express API (no Next.js server features — SSR/API
// routes/middleware — are used), so it can be hosted on any static host,
// same as the Flutter web build it's replacing. Deployed to GitHub Pages
// under /CPA-next/ (see BASE_PATH) rather than Vercel, since none of
// Vercel's server-side advantages apply here anyway.
const basePath = process.env.NEXT_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // Every route exports as its own index.html (e.g. /dashboard/index.html)
  // instead of dashboard.html — the shape GitHub Pages serves correctly
  // without any server-side rewrite rules.
  trailingSlash: true,
  images: {
    // No Image Optimization server on a static host; next/image isn't used
    // in this app yet, but this keeps it from breaking the build the
    // moment someone reaches for it.
    unoptimized: true,
  },
};

export default nextConfig;
