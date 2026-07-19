import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: packageRoot,
  },
  reactStrictMode: false,
};

export default nextConfig;
