import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  devIndicators: {
    buildActivity: false,
  },
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
