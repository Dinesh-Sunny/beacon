// Path Sentry's build plugin serves the browser tunnel on (next.config.ts). Plain module so the
// config can import it; site.ts keeps it out of robots.
export const SENTRY_TUNNEL_ROUTE = "/monitoring";
