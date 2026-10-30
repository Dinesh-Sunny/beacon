import { consentHostnames, getConsentBackend } from "@/lib/consent/backend";
import { limitConsentRequest } from "@/lib/consent/rate-limit";
import { guardConsentRequest } from "@/lib/consent/request-guard";
import { normalizeHost } from "@/lib/site-host";
import { getListedTenantByHost } from "@/lib/tenant";

// The app's own hosts, plus this request's host when it's a listed tenant domain (each tenant
// site records its visitors' choices under its own domain).
async function consentHostnamesFor(request: Request): Promise<string[]> {
  const host = normalizeHost(request.headers.get("host"));
  const tenant = host ? await getListedTenantByHost(host) : null;
  return tenant && host ? [...consentHostnames(), host] : consentHostnames();
}

// Consent API for the banner (c15t): init, save choices, status. Every request is rate limited
// per IP, then passes the guard (no PATCH, size cap, our domains only, no client-side account
// links).
async function handle(request: Request): Promise<Response> {
  const limited = await limitConsentRequest(request);
  if (limited) return limited;
  const guarded = await guardConsentRequest(
    request,
    await consentHostnamesFor(request),
  );
  if (guarded instanceof Response) return guarded;
  return getConsentBackend().handler(guarded);
}

export {
  handle as DELETE,
  handle as GET,
  handle as PATCH,
  handle as POST,
  handle as PUT,
};
