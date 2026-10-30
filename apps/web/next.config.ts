import type { NextConfig } from "next";
import "./src/lib/env.ts";

// Next.js inlines its boot scripts and styles, so 'unsafe-inline' stays for those; everything else is
// locked to this origin. The browser talks to postcodes.io for the council look-up, and the HF Space
// page shows the app in an iframe.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.postcodes.io",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'self' https://huggingface.co https://*.hf.space",
].join("; ");

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
          value: "camera=(), microphone=(), geolocation=()",
        },
        { key: "Content-Security-Policy", value: CSP },
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ],
    },
  ],
};

export default nextConfig;
