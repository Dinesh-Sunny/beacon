import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Every href is checked against the app's real routes at build time.
  typedRoutes: true,
  experimental: {
    // Detects lost connections, retries navigations and Server Actions, and powers useOffline.
    useOffline: true,
  },
  poweredByHeader: false,
  devIndicators: false,
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        {
          key: "Permissions-Policy",
          value: "camera=(self), microphone=(self), geolocation=()",
        },
      ],
    },
  ],
};

export default nextConfig;
