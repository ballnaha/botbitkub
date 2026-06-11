import type { NextConfig } from "next";

const isExport = process.env.NEXT_BUILD_EXPORT === "true";

const nextConfig: NextConfig = {
  output: isExport ? "export" : undefined,
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "localhost:4011",
    "127.0.0.1:4011",
  ],
  async rewrites() {
    if (isExport) return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8282/api/:path*",
      },
    ];
  },
};

export default nextConfig;
