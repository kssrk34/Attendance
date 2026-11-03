import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off: almost every page depends on the signed-in user, so pages render
  // per request. Branding is cached separately with unstable_cache + a tag (see src/server/config.ts).
  experimental: {
    serverActions: {
      // Logo uploads are up to 300 KB, sent as base64 (~400 KB).
      bodySizeLimit: "2mb",
    },
  },
  turbopack: {
    // Pin the project root (a stray lockfile in a parent folder can confuse detection).
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
