import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Commented out export mode to enable development server with API proxy
  // output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  outputFileTracingRoot: require('path').join(__dirname, '..'),
  
  // Add rewrites for API proxy to backend server
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*'
      },
      {
        source: '/socket.io/:path*',
        destination: 'http://localhost:3001/socket.io/:path*'
      }
    ];
  }
};

export default nextConfig;
