import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for deployment
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  outputFileTracingRoot: require('path').join(__dirname, '..')
  
  // Note: Rewrites don't work with static export
  // API calls use absolute URLs in the code instead
};

export default nextConfig;
