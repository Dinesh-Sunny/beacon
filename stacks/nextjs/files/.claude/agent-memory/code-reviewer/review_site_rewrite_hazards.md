---
name: review-site-rewrite-hazards
description: Recurring review hazards of the host -> internal [site] segment rewrite (multi-tenancy) in apps/web; check on any change under (site)/[site] or next.config rewrites
metadata:
  type: project
---

The public site lives under `app/(frontend)/(site)/[site]/`, filled by an afterFiles host rewrite in next.config.ts (ADR 0002).

- File-based metadata images (opengraph-image, twitter-image, icon) inside `[site]` get the internal host segment interpolated into their URL (Next `fillMetadataSegment`), so the public URL 404s. Check any new metadata file there.
- `[site]` is directly addressable wherever the rewrite does not fire (APP_PATH_PREFIXES with no catch-all route: `/api`, `/monitoring/*` without Sentry's o/p query, `/accept-invitation`, `/_next`). Check that getSiteForParam rejects those values.
- Any host not under TENANT_BASE_DOMAIN falls back to the default tenant, so arbitrary Host values create cached ISR pages on self-hosted deploys.
- Default-site indexability must match `IS_INDEXABLE` in lib/site.ts (it includes the VERCEL_PROJECT_PRODUCTION_URL fallback).

**Why:** found while reviewing feat/tenancy-routing (2026-10-03); these come from how the architecture works, not one-off typos.
**How to apply:** check all four on any PR touching tenant routing, site metadata, or next.config rewrites. The dev server can go stale after route moves ("module factory is not available"). Probe with `next start` instead.
