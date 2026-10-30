<!-- last-verified: 2026-10-03 -->
# Background jobs

How the template runs work later, again, or on a schedule: Payload's jobs queue, driven by one Vercel Cron. Read before adding a task, moving work out of a request, or changing the cron.

## Pieces

| Piece | Where | Notes |
| --- | --- | --- |
| Tasks | `apps/web/src/payload/jobs/tasks.ts` | typed input/output, retries with backoff, optional `schedule` |
| Slugs, queues, crons | `apps/web/src/payload/constants.ts` | `JOB_TASKS`, `JOB_QUEUES` (`default`, `maintenance`), `DAILY_MAINTENANCE_CRON` |
| Runner | `/api/payload-jobs/run?allQueues=true&limit=25&silent=true` | Payload's route; `CRON_SECRET` bearer or a staff session (`payload/access.ts`). The same call queues scheduled tasks |
| Cron | `vercel.json` | every minute (needs Vercel Pro; deploys are paused until then) |
| From packages | `enqueue` in `createAuth` → `payload/jobs/enqueue.ts` | packages stay queue-agnostic: `@__NAME__/auth` emits `AuthJob`s |

## Tasks

| Task | Queue | When | What |
| --- | --- | --- | --- |
| `cancel-subscriptions` | default | an organization with a live plan is deleted | ends its Stripe subscriptions; 5 retries (6 runs) over about 30 min; ended ones are skipped |
| `send-auth-email` | default | an auth email's first send failed | resends; 4 retries within minutes; the email is sealed and dropped once its link expires (`notAfter`) |
| `auth-cleanup` | maintenance | daily | expired sessions and verifications; invitations 30 days past expiry |
| `consent-retention` | maintenance | daily | consent records 2 years past their end, in batches of 1,000 |
| `jobs-cleanup` | maintenance | daily | releases jobs stuck `processing` over 15 minutes (killed runners); deletes failed jobs older than 14 days. Schedules itself even when an earlier run is stuck |
| `schedulePublish` | built in | per page | Payload's scheduled publish |

## Adding a task

1. Add the slug to `JOB_TASKS`, the config to `tasks.ts` and `JOB_TASK_CONFIGS`.
2. Make it safe to run twice (below). Throw to retry; return `output` to finish.
3. `pnpm --filter web cms:types`, then `pnpm cms:migrate:create <name>`: slugs are a Postgres enum.
4. Queue it with `payload.jobs.queue({ task, input, queue })`, or give it a `schedule` (6-field cron, server time zone: UTC on Vercel).

## Rules

- `retries.attempts: N` means N retries after the first run (N + 1 runs in all).
- Secrets never go into job input in plain text: Payload stores input and logs the whole job when a task fails. Seal them (`payload/jobs/sealed-input.ts`, AES-256-GCM keyed from `BETTER_AUTH_SECRET`). The cron runs with `silent=true`; each task's `onFail` logs only the task, job id, and tries.
- A job killed mid-run (time limit, crash) stays `processing` in Payload 3.90; `jobs-cleanup` releases it after 15 minutes so it retries.
- Every task is safe to run twice: Payload 3 can hand one job to two overlapping runners (fixed in 4.0). Deletes and Stripe cancels are naturally safe; a doubled email retry sends one extra email, which is accepted.
- Keep the first attempt inline when latency matters (sign-in emails); queue only the retry.
- Finished jobs are deleted (`deleteJobOnComplete`); failed ones stay 14 days for inspection.
- Task handlers import auth and email code inside the handler, so the Payload CLI (migrations, types) doesn't load it.
- The dev server doesn't reload task code: restart `pnpm dev` after changing a task.
- Never `autoRun` and never the `payload jobs:run` CLI: hooks call `revalidateTag`, which needs a Next request.
- Long or multi-step durable work (agents) goes to Vercel Workflow, added with the AI backend.

## Testing locally

There is no cron in development. Queue jobs (or let the route queue scheduled ones), then run them:
`curl -H "Authorization: Bearer $CRON_SECRET" "localhost:3000/api/payload-jobs/run?allQueues=true&limit=25&silent=true"`.
Scheduled tasks are queued with `waitUntil` set to their next cron time, so they run then, not on the first call.
