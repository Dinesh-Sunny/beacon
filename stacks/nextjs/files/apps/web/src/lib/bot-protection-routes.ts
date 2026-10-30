import { AUTH_BASE_PATH, BOT_CHECKED_AUTH_PATHS } from "@__NAME__/auth/config";
import { AGENT_ROUTE } from "@/lib/agents";
import { DATA_EXPORT_PATH } from "@/lib/privacy/config";

// Requests Vercel BotID checks (docs/knowledge/agent-ready.md). The browser attaches its
// challenge headers only to these (instrumentation-client.ts), and the server checks only these:
// a server check on a path missing here always fails. Client-safe: the browser imports it.
export type BotProtectedRoute = {
  path: string;
  method: "GET" | "POST";
};

export const BOT_PROTECTED_ROUTES: readonly BotProtectedRoute[] = [
  ...BOT_CHECKED_AUTH_PATHS.map((path) => ({
    path: `${AUTH_BASE_PATH}${path}`,
    method: "POST" as const,
  })),
  // Agent runs spend model credits.
  { path: `${AGENT_ROUTE}/*`, method: "POST" },
  { path: DATA_EXPORT_PATH, method: "GET" },
];
