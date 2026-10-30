<!-- last-verified: 2026-10-03 -->
# Compliance

How the template meets UK GDPR duties for the people who use a client's site: the audit log, "Download your data", and account deletion that reaches every system holding their data. Read before adding a table or service that stores personal data, a new security-relevant action, or a third party that receives user ids.

## Rights and where they live

| Right | What happens | Code |
| --- | --- | --- |
| Access and portability (Art. 15, 20) | Security page, "Download your data": one JSON file (profile, sign-in methods, sessions with IP and device, organizations, invitations sent and received, cookie choices, assistant conversations with their messages, shop orders with shipping details, own activity). Each section is capped at 1,000 rows and says `truncated` when cut. Same-origin requests only, a sign-in from the last 24 hours (read without the cookie cache), 5 an hour, recorded as `user.data_exported` | `apps/web/src/lib/privacy/export-data.ts`, `export.ts`, route `apps/web/src/app/api/account/export/route.ts` |
| Erasure (Art. 17) | Security page, "Delete account" (Better Auth `deleteUser`): sessions, accounts, memberships, agent threads cascade; organizations the person owns alone are deleted (keys and billing first). Then the `privacy-erase` job deletes linked consent records and the PostHog person with their events and recordings | `packages/auth/src/auth.ts` (`releaseSoleOwnedOrganizations`), `apps/web/src/lib/privacy/erase.ts`, `apps/web/src/payload/jobs/tasks.ts` |
| Rectification (Art. 16) | Profile page (name); email changes are not offered | account pages |
| Objection to tracking | Cookie banner and "Cookie settings" (docs/knowledge/consent.md) | `apps/web/src/components/consent/` |

## Audit log

- `audit.events` (migration `packages/db/migrations/0015_audit_events.sql`): partitioned by UTC month, append-only (triggers reject UPDATE and DELETE on every row and TRUNCATE on the table and each partition). Retention drops whole partitions after 13 full months (`AUDIT_RETENTION_MONTHS`); the daily `audit-partitions` job also creates the next 3 months. Rows for a month without a partition land in the default partition and move out when it's created.
- The triggers guard against mistakes in app code, not against a role set on bypassing them: any session can set the `audit.maintenance` flag the partition mover uses, and the owning role can drop triggers or partitions. For a tamper-evident trail, run the app as a role with only INSERT and SELECT on `audit.events`, keep partition maintenance under a separate owner, and ship events to an external write-once store.
- Actions are listed once in `AUDIT_ACTIONS` (`packages/db/src/audit.ts`): sign-up, finished sign-ins (not the password step of a two-factor sign-in), deliberate sign-outs and device revokes (not sessions Better Auth replaces), password changes and resets, two-factor changes, data export, account deletion; organization create/update/delete; members, roles, invitations; API keys; subscription changes; shop orders created and refunded (`commerce`, written by the shop webhook, not Better Auth hooks).
- Rows hold ids and small facts (roles, key names, plan), never emails, names, or IPs. API key names are free text, so a name someone types could hold personal data. Once an account is deleted its rows no longer identify anyone, so they're kept (legitimate interest: security and dispute records).
- Emitted from `@__NAME__/auth` hooks as typed `AuthEvent`s (actor from Better Auth's request context), written by `apps/web/src/lib/auth-events.ts`. A failed write is logged and never blocks sign-in.
- Owners and admins read their organization's events on the Activity page (`audit:read`); people read their own in the export.
- Adding an action: add it to `AUDIT_ACTIONS`, emit it, map it in `apps/web/src/lib/audit-events.ts`, and word it in `apps/web/src/lib/audit-labels.ts` (both are exhaustive, so the type-check lists what's missing).

## Erasure details

- Consent: a signed-in browser's consent subject is linked to the account (`ConsentIdentity` in the account shell, server action, unlinked subjects only), so erasure and export find it. Shared browsers: signing out clears the stored cookie choice, and a subject already linked to another account is cleared too, so each person's choices get their own subject. The consent API refuses to read subjects (they name the linked account), and subject ids are scrubbed from logged URLs. The daily consent-retention job also erases consent linked to accounts that no longer exist, in case an erasure job was never queued.
- PostHog: `POST /api/projects/:id/persons/bulk_delete/` with `delete_events` and `delete_recordings`, distinct id = user id. Needs `POSTHOG_PERSONAL_API_KEY` (scope `person:write`) and `POSTHOG_PROJECT_ID`; unset, the step is skipped with a warning. Retried 10 times (about a day). If queueing fails the log says so: delete the person in PostHog by user id.
- Sentry holds only user ids (docs/knowledge/observability.md); nothing to delete.
- Stripe: customers belong to organizations, not people. Kept for tax records (legal obligation); subscriptions of deleted organizations are cancelled.
- Agent conversations: `agent_threads` cascade; LangGraph checkpoints of deleted threads are removed by the daily `agent-threads-cleanup` job.
- Shop orders: the `privacy-erase` job also runs `eraseShopData` (`apps/web/src/lib/privacy/erase-shop.ts`). Orders and transactions are kept for UK VAT records (6 years) but lose the customer link, email, and name; addresses reduce to the country. The customer record and open carts are deleted. Orders match by customer link or, for guest orders, the account's email. The email travels sealed in the job input. Stripe holds the payment records (legal obligation).
- Payload CMS editors are staff accounts, outside these flows.

## Retention

| Data | Kept | Removed by |
| --- | --- | --- |
| Audit events | 13 full months | `audit-partitions` (daily) |
| Consent records | Choice end + 2 years | `consent-retention` (daily) |
| Expired sessions, verifications | Until expiry | `auth-cleanup` (daily) |
| Invitations | Expiry + 30 days | `auth-cleanup` |
| Idle agent conversations | `AGENT_THREAD_RETENTION_DAYS` | `agent-threads-cleanup` |
| Failed jobs | 14 days | `jobs-cleanup` |

## Related

- Consent: docs/knowledge/consent.md · Observability: docs/knowledge/observability.md · Jobs: docs/knowledge/jobs.md
