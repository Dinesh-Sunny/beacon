import type { Route } from "next";

export const TEXT_STATS_PAGE = {
  title: "Text stats",
  description: "Next.js server action → private Python service (python/api).",
  // Served under the internal `[site]` segment; the host rewrite maps it to this path.
  path: "/text-stats" as Route,
} as const;
