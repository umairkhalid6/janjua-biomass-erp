import type { NextConfig } from "next";

// PWA note: Next 16 builds with Turbopack, which webpack-based PWA plugins
// (next-pwa, @ducanh2912/next-pwa) silently ignore. The service worker is
// instead a plain static file (public/sw.js, registered by
// src/components/sw-register.tsx) that caches static assets only — documents
// and API responses are never cached, so financials are always live.
const nextConfig: NextConfig = {
  output: "standalone",
  // Lets a second dev server (e.g. a preview sandbox) run alongside the main
  // one by giving it its own build dir — Next's dev lock lives in distDir.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    // Pin the workspace root to this project, suppressing the multi-lockfile warning
    root: __dirname,
  },
};

export default nextConfig;
