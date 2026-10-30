# code-reviewer memory

<!--
  Persistent memory for the "code-reviewer" subagent (frontmatter: memory: project).
  Committed so the team shares what the agent learns. Claude Code loads the start of this file
  into the subagent's context, so keep it short. Use one line per entry and link detail files.
-->

## Recurring patterns
- <!-- e.g. "Date handling: always use utils/date.ts, not raw Date parsing" -->

## Known pitfalls
- Hook gates/regex linters fail silently (unanchored slash grep, sticky Stop state, Path.match `**`, multi-line JSX). See [hook-and-linter-pitfalls.md](hook-and-linter-pitfalls.md)

## Detail files
- [db-review-checks.md](db-review-checks.md): pool timeouts, lifespan leaks, preview migrations, CTE blowup, jsonpath silent, checked-out client crash, role defaults
- [payload-review-checks.md](payload-review-checks.md): previousDoc=latest version, jobs log input, CLI config before PAYLOAD_MIGRATING, multi-tenant plugin access/backfill
- [better-auth-review-checks.md](better-auth-review-checks.md): trustedOrigins, JWT iss, magic link skips 2FA, listApiKeys 403, next tab bypass, deleteUser orphans org keys
- [next-react-form-review-checks.md](next-react-form-review-checks.md): form auto-reset, __proto__ param lookups, error.tsx retry/layout gap, focus loss
- [review-false-positive-traps.md](review-false-positive-traps.md) — inbox [promoted] semantics, Next SEO via build output, regex m-flag CRLF, rtk-mangled biome output
- <!-- e.g. [auth-flows.md](auth-flows.md) -->
- [Consent/tracker teardown checks](consent-tracker-review-checks.md) — cookieStore.delete misses Domain cookies, posthog reset clears opt-out, c15t reset/index gaps
- [Rate-limit review checks](ratelimit-review-checks.md) — Upstash signal/retry/error-log semantics, INCR no-TTL lockout, BA customStorage, IPv6 keys
- [Stripe billing review checks](stripe-billing-review-checks.md) — dup subs from past_due/incomplete, plugin blocks org delete, swallowed webhook errors
- [Observability review checks](observability-review-checks.md) — Sentry span-attribute and PostHog session-entry leak paths, Python data_collection, server consent
- [AI agent review checks](ai-agent-review-checks.md) — AG-UI raw events leak prompt, client state/forwarded_props into graph, OIDC header not env, sync Langfuse flush
- [Better Auth hook semantics](better-auth-hook-semantics.md) — 1.7.7: updateMany after gets a count, 2FA rotates sessions, ctx identity in hooks
- [BotID + agent-ready checks](botid-agent-ready-review-checks.md) — checkBotId throws off-Vercel prod, client patches fetch/XHR only, build table for ƒ routes
- [Site rewrite hazards](review_site_rewrite_hazards.md) — [site] host-rewrite pitfalls: OG URLs, prefix shadowing, default fallback, indexability
