---
name: observability-review-checks
description: Verified Sentry 11 / sentry-sdk 2.x / posthog-js leak paths for secrets in URLs and personal data; check before approving any error-tracking or analytics change
metadata:
  type: project
---

- Sentry `beforeSend` URL scrubbing misses span attributes: Next sets `http.target` (path + query) and Sentry sets `url.path`/`url.full`; `urlQueryParams.deny` covers query params only, never path secrets. Scrub `contexts.trace.data`, `spans[].data`, span descriptions, and the transaction name.
- posthog-js adds `$session_entry_url/pathname/referrer` to every event and sends `$set`/`$set_once`; a per-key `before_send` list misses them. Use `mask_personal_data_properties` plus a key-pattern scrubber.
- sentry-sdk (Python) `send_default_pii=False` still attaches JSON request bodies and frame locals; set `data_collection` (`http_bodies: []`, `stack_frame_variables: False`). `DataCollectionUserOptions` exists only under TYPE_CHECKING, so import it behind `if TYPE_CHECKING`.
- Server-side analytics needs the same consent gate as the browser; a browser-only network check proves nothing about `posthog-node`.

How to apply: for any change touching `apps/web/src/lib/observability/` or `__PYNAME___core.observability`, ask where else a URL travels and whether a fixture test covers it. See [[review-false-positive-traps]].
- c15t 2.3 client ignores the policy's `expiryDays` (cookie lifetime is `storageConfig.defaultExpiryDays`, default 365) and recreates its cookie from localStorage; expiry must be enforced in app code. Its `background` backend option is types-only in 2.3.0, and its auto-reload on revocation doesn't wait for async cleanup.
- c15t's public `/subjects` API accepts unbounded metadata, any `domain`, and client-sent account links; check for a request guard and `scopeMode: "strict"`.
