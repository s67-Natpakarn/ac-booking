import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel packages its own server output; Docker needs the standalone server.
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
