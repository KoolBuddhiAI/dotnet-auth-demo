import type { NextConfig } from "next";

const apiUrl = process.env.API_URL ?? "http://localhost:5090";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: "/connect/:path*",
        destination: `${apiUrl}/connect/:path*`,
      },
    ];
  },
};

export default nextConfig;
