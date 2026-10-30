import type { AuthEmailKind } from "@__NAME__/auth/config";
import type { Route } from "next";

// Local development has no mail server (auth emails only reach the server log), so the inbox
// screens link here to open the last emailed link. Production builds never show it, and the
// route 404s there: these links sign people in. `pnpm dev` binds to 127.0.0.1 so the route
// isn't reachable from other machines on the network either.
export const DEV_OUTBOX_ENABLED = process.env.NODE_ENV !== "production";

export const DEV_OUTBOX_PATH = "/api/dev/outbox";

// The kind keeps each screen on its own link: the reset screen never opens a sign-in link.
export function devOutboxHref(kind: AuthEmailKind, email: string): Route {
  const query = new URLSearchParams({ kind, to: email });
  return `${DEV_OUTBOX_PATH}?${query}` as Route;
}
