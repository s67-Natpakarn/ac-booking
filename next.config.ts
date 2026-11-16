import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only Docker builds opt in; hosted platforms package their own server output.
  ...(process.env.NEXT_OUTPUT_STANDALONE === "1"
    ? { output: "standalone" as const }
    : {}),
};

export default nextConfig;
