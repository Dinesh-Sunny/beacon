---
name: next-react-form-review-checks
description: Recurring Next 16 / React 19 UI defects in apps/web (form auto-reset on error, prototype-key lookups on URL params, error.tsx reset vs retry and layout coverage, focus loss on step swaps); check on any form or route-boundary diff
metadata:
  type: project
---

First seen reviewing feat/auth-ui (2026-10-02, Next 16.3.8, React 19.2.8).

- `<form action={fn}>` calls `requestFormReset` on EVERY submit (react-dom startHostTransition), so returning an error state still wipes uncontrolled inputs. Look for useActionState forms with uncontrolled name/email fields.
- `Record<string,string>` lookups keyed by URL params (`MESSAGES[code]`) return Object.prototype or functions for `__proto__`/`constructor`, and the RSC render throws. Prove it with curl `?error=__proto__` on the dev server and grep for "Switched to client rendering".
- Next 16.3 error.tsx: `reset()` does not refetch server data, so use `retry()`. error.js does not wrap the layout in the same segment, and there is no (frontend)/error.tsx or global-error.
- Pages that call `requireSession()` (throws) get no layout re-check during client navigation, so an expired session renders the error boundary instead of redirecting to sign-in.
- `next dev` sets no default host (cli/next-dev.js), so it listens on every interface. NODE_ENV-gated dev routes (dev outbox) are reachable from the LAN.
- Step flows remounted via `key` ("use a different email") start with moved=false, so nothing takes focus. Props like linkError keyed to attempt 0 reappear on every return to step 1.
- Swapping a form for a success or inbox view unmounts the focused button. An aria-live container mounted together with its content is rarely announced.

**Why:** all of these pass `pnpm check` and only show up with bad input, an expired session, or a screen reader.
**How to apply:** for apps/web form or route diffs, grep `action={`, `MESSAGES[`, and `error.tsx` props, then curl the crafted params against the running `pnpm dev`. See also [[better-auth-review-checks]].
