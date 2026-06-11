import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "localhost:4011",
    "127.0.0.1:4011",
  ],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8282/api/:path*",
      },
    ];
  },
};

export default nextConfig;
