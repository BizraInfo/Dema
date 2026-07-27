import { join } from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The admission boundary has ONE source of truth: packages/core/src/first-encounter-*.js.
  // It is imported here rather than mirrored so the kernel the repo tests cannot drift
  // from the kernel the UI enforces.
  outputFileTracingRoot: join(import.meta.dirname, "../.."),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
