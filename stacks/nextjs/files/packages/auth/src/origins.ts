// Which hosts Better Auth treats as its own, and the one canonical origin for links and token
// issuer. Every allowed host is also trusted for redirects (callbackURL, redirectTo), so each
// environment lists only its own hosts. A wildcard like `*.vercel.app` would let any Vercel
// project receive password-reset tokens.
// Mirrored in python/core/src/__PYNAME___core/auth.py (resolve_issuer); keep them in step.
import { AUTH_ENV } from "./config.ts";

type Env = Readonly<Record<string, string | undefined>>;

export type AuthOrigins = {
  // Links in emails, and the `iss` of service tokens.
  canonical: string;
  allowedHosts: string[];
};

const LOCAL_ORIGIN = "http://localhost:3000";
const LOCAL_HOSTS = "localhost:*";

export class AuthConfigError extends Error {
  override name = "AuthConfigError";
}

export function resolveAuthOrigins(env: Env = process.env): AuthOrigins {
  const isProduction = env.NODE_ENV === "production";
  const isPreview = env.VERCEL_ENV === "preview";
  const configured = env[AUTH_ENV.url]
    ? new URL(env[AUTH_ENV.url] as string)
    : undefined;
  const hosts = new Set<string>();

  if (configured) hosts.add(configured.host);
  // This deployment's own URLs (Vercel sets them per deployment).
  if (env.VERCEL_URL) hosts.add(env.VERCEL_URL);
  if (isPreview && env.VERCEL_BRANCH_URL) hosts.add(env.VERCEL_BRANCH_URL);
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) {
    hosts.add(env.VERCEL_PROJECT_PRODUCTION_URL);
  }
  if (!isProduction) hosts.add(LOCAL_HOSTS);

  return {
    canonical: canonicalOrigin(env, configured, isPreview, isProduction),
    allowedHosts: [...hosts],
  };
}

function canonicalOrigin(
  env: Env,
  configured: URL | undefined,
  isPreview: boolean,
  isProduction: boolean,
): string {
  // Previews use their own URL: a project-wide BETTER_AUTH_URL points at production, whose
  // signing keys and database differ.
  const previewHost = env.VERCEL_BRANCH_URL ?? env.VERCEL_URL;
  if (isPreview && previewHost) return `https://${previewHost}`;
  if (configured) return configured.origin;
  if (env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (isProduction) {
    throw new AuthConfigError(`${AUTH_ENV.url} must be set in production`);
  }
  return LOCAL_ORIGIN;
}
