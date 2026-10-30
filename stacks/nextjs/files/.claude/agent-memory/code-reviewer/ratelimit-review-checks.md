---
name: ratelimit-review-checks
description: Rate-limit review checks (@upstash/redis abort/retry/error semantics, INCR+PEXPIRE no-TTL lockout, Better Auth customStorage contract, client-IP keying)
metadata:
  type: project
---

First seen reviewing feat/rate-limits (2026-10-03, @upstash/redis 1.39, better-auth 1.7.7).

- @upstash/redis `signal`: a plain AbortSignal makes an aborted request RESOLVE with `result: reason ?? "Aborted"`. Only the function form `signal: () => ...` throws. A limiter that gets "Aborted" back destructures garbage.
- @upstash/redis `retry: false` still makes 2 fetches on network errors (loop `i <= attempts`, attempts=1).
- UpstashError's message includes `command was: <JSON body>`, so it logs keys (client IPs) and script text.
- Lua `INCR; if count==1 then PEXPIRE` locks a key out forever if it ever lacks a TTL (a non-integer PEXPIRE arg errors after INCR has persisted). Guard with `PTTL < 0`. Reproduce on the local SRH container.
- Better Auth customStorage: `consume(key, {window, max})` with key `${ip}|${path}`. retryAfter is in seconds (null falls back to window). If consume throws, the request fails. Default IP header is single-value x-forwarded-for, with IPv6 collapsed to /64 (`normalizeIP` in @better-auth/core/utils/ip).
- Hand-rolled per-IP keys from raw headers skip IPv6 /64 collapsing and validation. Compare them with Better Auth's normalizeIP.
- Integration tests skip when env is missing, and `.env.local` often lacks new vars. Rerun with the env exported before trusting "pass".

**Why:** these all look correct in the diff and pass the happy-path tests.
**How to apply:** when a review touches limiters, Redis/Upstash, or IP-keyed logic, grep the installed dist and probe the local container. See [[better-auth-review-checks]].
