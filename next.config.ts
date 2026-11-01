import type { NextConfig } from "next";

/**
 * GitHub Pages project site:
 * https://btwvansh.github.io/upi-gen/
 *
 * The base path is applied to pages, assets and manual links. Build with
 * `npm run build` to produce the static `out/` directory.
 */
const basePath = (
  process.env.NEXT_PUBLIC_BASE_PATH || "/upi-gen"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
