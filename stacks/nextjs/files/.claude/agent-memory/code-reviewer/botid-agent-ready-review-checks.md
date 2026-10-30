---
name: botid-agent-ready-review-checks
description: Verified botid 1.5.11 runtime behavior (server throws off-Vercel, client patch scope) and how to check Next 16 route-handler caching for Markdown/llms routes
metadata:
  type: project
---

Verified in node_modules/botid/dist on 2026-10-03 (botid 1.5.11). Re-check if the version moves.

- `checkBotId` returns HUMAN only when `NODE_ENV !== "production"`. Under `next start`/self-host it calls api.vercel.com, then throws ("x-vercel-oidc-token missing" or "Must be deployed on Vercel to set response headers"). Reproduced: sign-in 500 on `next start`.
- Server reads headers from Vercel's request context (`Symbol.for("@vercel/request-context")`), not `next/headers`, so it works inside Better Auth hooks on Vercel.
- Client `initBotId` patches only same-origin `fetch`/XHR; `*` becomes `.*` (anchored); the method must match. Navigations, form posts, and server actions get no headers. It still loads the challenge from api.vercel.com in dev, and a failed script load rejects the wrapped fetch.
- `opt_in_capturing()` in posthog-js fires the initial `$pageview` synchronously; `init` defers it with setTimeout(1).
- Route handler cost: run `next build` (Next 16 dev uses `.next/dev`, so a running dev server is safe) and read the route table. Lexical→Markdown handlers came out ƒ (per request) even with "use cache" data underneath.

**Why:** found while reviewing feat/agent-ready; the docs claimed "locally always human", which only holds for `next dev`.
**How to apply:** for any BotID change, test `next start` and check that every protected call site is same-origin fetch. See [[review-false-positive-traps]].
