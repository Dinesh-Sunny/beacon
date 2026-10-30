---
name: payload-review-checks
description: Verified Payload 3.x behaviors that decide whether CMS hooks, jobs, access, and migration scripts in apps/web are correct; check before flagging or approving Payload changes
metadata:
  type: project
---

Verified in node_modules while reviewing feat/cms (Payload 3.90.2, 2026-10-02).

- In update hooks, `previousDoc`/`originalDoc` is the LATEST VERSION (often a draft), not the published doc. "Was published?" checks that use previousDoc._status miss unpublish-after-edit and slug renames.
- `schedulePublish` only queues a job. Without a `jobs` config plus a runner (Vercel Cron to /api/payload-jobs/run), scheduled publishes never fire. Default `jobs.access.run` needs a logged-in user.
- `payload run <script> a b` rewrites argv to [node, bin, a, b] and does NOT load the config first, so env set before a dynamic `import("@payload-config")` takes effect.
- Payload's JWT strategy reloads the user with `findByID` on every request. `saveToJWT` does not skip a DB lookup.
- Field access (create/update) runs in beforeValidate, before collection beforeChange hooks.
- Postgres `connectWithReconnect` checks out one pool client and never releases it. `db.destroy()` keeps the pool, so HMR reuses it (onInit-registered listeners survive).
- Payload migration failure calls `process.exit(1)`, so `finally` blocks don't run. A batch -1 (dev push) row makes `migrate` prompt, and a non-TTY build exits 0.
- @payloadcms/next emits no robots noindex for /admin.

**Why:** these are the facts that decided real findings vs false alarms; reading the code took most of the review.
**How to apply:** grep the installed version's dist before relying on these after a Payload upgrade. See also [[db-review-checks]].
- With no `serverURL`, `csrf` defaults to [], so getRequestOrigin returns '' and formatAdminURL gives a RELATIVE link (`/admin/reset/<token>`) in forgot-password emails. Setting serverURL also pushes it into csrf. Seen feat/email.

Jobs queue facts (verified feat/jobs, Payload 3.90.2, dist/queues):
- handleTaskError logs `{err, job}` via payload.logger.error on EVERY failed attempt; `job.input` is logged in full. Secrets in task input (email links) reach stdout/log drains. Only `silent` (run endpoint `?silent=true`) suppresses it; `onFail(input, job)` is the hook for sanitized logging.
- No stale-`processing` recovery: a job killed mid-run stays processing=true forever, is never retried, and (countRunnableOrActiveJobsForQueue ignores processing) blocks its scheduled task from ever being queued again.
- Task `retries: {attempts: N}` = N retries, N+1 runs. Exponential wait = 2^totalTried * delay. Scheduling: run endpoint queues one pending job per scheduled task (waitUntil = next croner time, process TZ); dedupe is a count of non-completed, error-less jobs with meta.scheduled.
- `payload.jobs.queue` defaults overrideAccess=true; jobs collection read access is `() => false`.
- The `payload` CLI imports the config BEFORE bin/migrate.js sets PAYLOAD_MIGRATING, so module-level `process.env.PAYLOAD_MIGRATING` checks are false for `payload migrate*`. Only our `payload run` script (sets it before dynamic import) sees it. migrate:create skips DB connect.

CMS site rendering facts (verified feat/cms-site, Payload 3.90.2 / Next 16.3.8, 2026-10-03):
- `find({ pagination: false, limit: N })` still honours limit (sanitizedLimit). A shared "prerender limit" silently truncates sitemaps.
- Saving a draft (`draft: true`, non-published) skips db.updateOne and skips validation, so field validators only bite on publish.
- Lexical LinkFeature url validation is only "no spaces" (javascript:, http:, www., #anchor, tel: all save). Default internal-link targets = every non-hidden collection (Users included).
- Lexical defaultJSXConverters have NO `relationship` converter; the default editor's relationship node renders the literal text "unknown node".
- Under cacheComponents, notFound()/redirect() after a cold `use cache` miss in a PPR route return HTTP 200 + noindex meta (soft 404, client redirect); warm cache gives the real 404/308. Probe each URL twice on `next start`.
- A page-level `openGraph` (pageMetadata) drops a parent segment's file-based opengraph-image: no og:image at all.
- Switch over a union with no `never` default is NOT exhaustive here (no noImplicitReturns in apps/web tsconfig).

Multi-tenant plugin facts (verified feat/tenancy-data, @payloadcms/plugin-multi-tenant 3.90.2, 2026-10-03):
- withTenantAccess: a staff user with ZERO tenants gets `false` on every tenant-scoped collection (only own user doc). Migrations that add the plugin must backfill `users_tenants` for existing editors.
- Users `tenants` array create/update access = userHasAccessToAllTenants only (no self-escalation). Same callback scopes the tenants collection itself (id in user tenants).
- Anonymous reads are NOT scoped (no req.user -> base access result returned as-is); REST /api/<col> exposes every tenant's published docs.
- tenant field defaultValue: payload-tenant cookie, else (autosave collections) user's first tenant, else null. Drafts/autosave skip `required`, so admins with "all tenants" create tenant=NULL drafts.
- addFilterOptionsToFields only touches `relationship` fields, not `upload` or Lexical links: cross-tenant media/link IDs are accepted.
- Non-global collections get an "Assign tenant" edit-menu action: tenant moves are first-class, so per-tenant cache hooks must revalidate the OLD tenant too.
- Users list baseFilter: with a tenant selected, users without that tenant (all admins) vanish from the list.
- Field `validate` is server-only (payload/dist/fields/config/client.js strips it); async DB validators never run in the browser.
- Drizzle compound index names (`tenant_slug_idx`) get collision suffixes via buildIndexName; a duplicate raises ValidationError with path "tenant_id, slug" (no inline field error).
