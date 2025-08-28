import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  outputFileTracingRoot: require('path').join(__dirname, '..'),
};

export default nextConfig;
