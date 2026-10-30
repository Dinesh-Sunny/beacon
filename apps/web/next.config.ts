import type { NextConfig } from "next";
import "./src/lib/env.ts";

const nextConfig: NextConfig = {
  reactCompiler: true,
  typedRoutes: true,
  poweredByHeader: false,
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ["@beacon/rules", "@beacon/brain"],
  // Loaded by Node at run time, not bundled: deepagents pulls in optional modules (langsmith sandbox, ws).
  serverExternalPackages: ["deepagents"],
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(self), geolocation=()",
        },
      ],
    },
  ],
};

export default nextConfig;
