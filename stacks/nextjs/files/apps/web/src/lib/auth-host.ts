import {
  AuthConfigError,
  type AuthOrigins,
  resolveAuthOrigins,
} from "@__NAME__/auth/origins";
import { SITE_URL } from "@/lib/site";

// Sign-in, account, and billing live on the app host only (docs/adr/0002-multi-tenancy.md):
// tenant domains are never Better Auth trusted hosts, since every trusted host is also a valid
// redirect target.

// A production build without BETTER_AUTH_URL (CI, `next build` before env is set) still renders
// site pages: treat the site's own URL as the app host. Auth itself refuses to start without it.
function origins(): AuthOrigins {
  try {
    return resolveAuthOrigins();
  } catch (error) {
    if (!(error instanceof AuthConfigError)) throw error;
    return { canonical: SITE_URL.origin, allowedHosts: [SITE_URL.host] };
  }
}

function hostname(entry: string): string {
  return entry.replace(/:(\d+|\*)$/, "").toLowerCase();
}

export function authHostnames(): string[] {
  return origins().allowedHosts.map(hostname);
}

export function isAuthHost(host: string): boolean {
  return authHostnames().includes(hostname(host));
}

// Absolute URL on the app host, for links from tenant sites.
export function authUrl(path: string): string {
  return new URL(path, origins().canonical).toString();
}
