# 0002. Multi-tenancy

- Status: Accepted
- Date: 2026-10-03

## Context

Forks need to run many client sites ("tenants") from one deployment, each picked by the request host (a custom domain or `<slug>.<base domain>`) and mapped to a Better Auth organization. Single-tenant forks must keep working with no setup. Under Cache Components, pages must stay static or cached per tenant, and `apps/web/src/proxy.ts` must stay minimal (better-auth#9776).

Options for host → tenant: a proxy rewrite with a lookup store (Vercel Platforms pattern), reading `headers()` in pages (every view dynamic), or a `next.config.ts` rewrite that captures the host into an internal route segment.

## Decision

- `@payloadcms/plugin-multi-tenant` (pinned with Payload) scopes pages, media, and navigation. Navigation becomes a per-tenant collection. Admins see every tenant; editors get a tenants array.
- A `tenants` collection holds name, slug, domains, the Better Auth organization id, status, and site identity. A seeded `default` tenant owns all existing content and answers any host that isn't a known tenant domain.
- A `next.config.ts` rewrite captures the host into an internal `[site]` segment; a cached host lookup resolves the tenant. No proxy change and no runtime lookup store.
- Public CMS reads take a required tenant id, and cache tags carry it. The plugin doesn't scope anonymous reads, so the site's own filters (tested) are the isolation boundary.
- Sign-in, account, billing, and the CMS admin stay on one app host (`BETTER_AUTH_URL`); tenant domains redirect those paths there. No cross-domain sessions.
- Domains are added per tenant by a super admin (Payload + Vercel). No wildcard subdomains.
- No Postgres row-level security.

## Consequences

- Adding a tenant domain is a Payload edit plus attaching the domain in Vercel.
- Alias hosts create separate cache entries unless redirected at the domain level.
- Route handlers (sitemap, robots, llms.txt, Markdown) resolve the tenant from the request host at run time; their data stays cached.
- Sign-in on tenant domains, per-tenant theming presets, and physical isolation are later phases.
- Built in two steps: data model (tenants, plugin, scoped reads, default tenant), then routing (host capture, per-tenant metadata, redirects).
