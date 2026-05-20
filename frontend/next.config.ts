import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use static export only when building for Capacitor, allowing dynamic serverless builds on Vercel
  output: process.env.BUILD_MOBILE ? 'export' : undefined,
  images: {
    unoptimized: true,
  }
};

export default nextConfig;
