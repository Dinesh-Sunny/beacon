import * as Sentry from "@sentry/nextjs";

// Server and edge runtimes. Each runtime loads its own init so the edge bundle never pulls in
// Node-only Sentry code.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Errors thrown in Server Components, Route Handlers, Server Actions, and proxy.ts.
export const onRequestError = Sentry.captureRequestError;
