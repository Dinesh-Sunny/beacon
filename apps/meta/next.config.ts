import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  devIndicators: false,
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
      ],
    },
  ],
};

export default nextConfig;
