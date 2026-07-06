import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    // Pin the workspace root to this project, suppressing the multi-lockfile warning
    root: __dirname,
  },
};

export default nextConfig;
