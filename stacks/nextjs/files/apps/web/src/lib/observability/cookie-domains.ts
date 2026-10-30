// Domains a tracker cookie may have been set on for this host. GA4 (`cookie_domain: "auto"`) and
// PostHog (`cross_subdomain_cookie`) set theirs on a parent domain in production, and a cookie
// can only be deleted with the domain it was set on. Pure so it can be tested; analytics.ts uses it.

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

// "www.example.co.uk" → ["www.example.co.uk", "example.co.uk", "co.uk"]. Public suffixes such as
// "co.uk" can't hold cookies, so deleting there does nothing; that is cheaper than shipping a
// public suffix list.
export function cookieDomains(hostname: string): string[] {
  if (IPV4.test(hostname) || hostname.includes(":")) return [];
  const labels = hostname.split(".");
  const domains: string[] = [];
  for (let start = 0; start < labels.length - 1; start++) {
    domains.push(labels.slice(start).join("."));
  }
  return domains;
}
