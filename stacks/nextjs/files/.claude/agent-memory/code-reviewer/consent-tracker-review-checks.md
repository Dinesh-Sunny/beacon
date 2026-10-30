---
name: consent-tracker-review-checks
description: Verified withdrawal/expiry traps for c15t 2.3 + posthog-js 1.43x + GA4 cookie cleanup; check before approving any consent or tracker-teardown change
metadata:
  type: project
---

- `cookieStore.delete(name)` removes only the host-only cookie. GA4 (`cookie_domain: auto`) and PostHog (`cross_subdomain_cookie` true off vercel.app/herokuapp) set `Domain=` cookies, so delete per parent domain. Localhost hides this.
- posthog-js `reset()` calls `consent.reset()`, which clears a prior `opt_out_capturing()`. opt_out then reset means capturing again, and `$pageleave` fires on the reload. Call reset first, then opt out, and opt in on re-grant.
- c15t `resetConsents()` sets no `activeUI` and never calls `updateScripts`. The runtime starts `/init` in `useMemo` during render, so app-side expiry checks in `useEffect` race c15t's script loader.
- c15t v2 fumadb schema emits no indexes, and `domain.name` is not unique. Public GET `/consents/check?externalId=` and GET `/subjects/:id` then seq-scan `subject` and `consent`.
- Public c15t GETs pass straight through a POST-only body guard. Check `/consents/check` too, not just `/subjects`.

**Why:** found reviewing feat/consent (PR #10, 2026-10-03). Every one passed `pnpm check` and a localhost "verified live".
**How to apply:** for consent or teardown diffs, trace each tracker's cookie Domain and storage, and SDK reset semantics, in node_modules. See [[observability-review-checks]].
