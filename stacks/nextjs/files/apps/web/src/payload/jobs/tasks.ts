// Background tasks run by the cron route (vercel.json → /api/payload-jobs/run). Every handler is
// safe to run twice: Payload 3 can hand one job to two overlapping runners. Auth and email code
// is imported inside handlers, so the Payload CLI (migrations, types) doesn't load it.
import type { AuthEmail } from "@__NAME__/auth";
import { AUTH_ENV, BILLING_ENV } from "@__NAME__/auth/config";
import type { TaskConfig } from "payload";

type TaskCallbackFn = NonNullable<TaskConfig["onFail"]>;

import { deleteExpiredAgentThreads } from "@/lib/agent-retention";
import { deleteExpiredConsentRecords } from "@/lib/consent/retention";
import {
  DAILY_MAINTENANCE_CRON,
  FAILED_JOB_RETENTION_DAYS,
  JOB_QUEUES,
  JOB_TASKS,
  JOBS_COLLECTION,
  STUCK_JOB_MINUTES,
} from "@/payload/constants";
import { openJobInput } from "@/payload/jobs/sealed-input";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const dailyMaintenance = [
  { cron: DAILY_MAINTENANCE_CRON, queue: JOB_QUEUES.maintenance },
];

// Payload logs the whole job (input included) on failure; the cron runs with `silent=true`, so
// this is the record: which task, which job, what kind of error. Nothing from the input.
const logFailure: TaskCallbackFn = ({ job, taskStatus }) => {
  console.error("[jobs] task failed", {
    task: job.taskSlug,
    jobId: job.id,
    tries: taskStatus?.totalTried ?? null,
  });
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isAuthEmail(value: unknown): value is AuthEmail {
  if (typeof value !== "object" || value === null) return false;
  const email = value as Record<string, unknown>;
  return (
    typeof email.kind === "string" &&
    typeof email.to === "string" &&
    typeof email.url === "string"
  );
}

// Billing for deleted organizations. Retried 5 times over about half an hour (6 runs in all):
// Stripe outages are usually short, and a subscription Stripe already ended is skipped.
export const cancelSubscriptionsTask: TaskConfig<{
  input: { stripeSubscriptionIds: string[] };
  output: { cancelled: number };
}> = {
  slug: JOB_TASKS.cancelSubscriptions,
  inputSchema: [
    { name: "stripeSubscriptionIds", type: "json", required: true },
  ],
  outputSchema: [{ name: "cancelled", type: "number", required: true }],
  retries: { attempts: 5, backoff: { type: "exponential", delay: MINUTE_MS } },
  onFail: logFailure,
  handler: async ({ input }) => {
    if (!isStringArray(input.stripeSubscriptionIds)) {
      throw new Error("stripeSubscriptionIds must be a list of ids");
    }
    const { cancelStripeSubscriptions } = await import("@__NAME__/auth");
    await cancelStripeSubscriptions(
      requiredEnv(BILLING_ENV.secretKey),
      input.stripeSubscriptionIds,
    );
    return { output: { cancelled: input.stripeSubscriptionIds.length } };
  },
};

// An auth email whose first send failed. The email (its link carries a token) is sealed; only the
// kind is readable. Once its link has expired the job finishes without sending.
export const sendAuthEmailTask: TaskConfig<{
  input: { kind: string; sealed: string; notAfter: number };
  output: { sent: boolean };
}> = {
  slug: JOB_TASKS.sendAuthEmail,
  inputSchema: [
    { name: "kind", type: "text", required: true },
    { name: "sealed", type: "text", required: true },
    { name: "notAfter", type: "number", required: true },
  ],
  outputSchema: [{ name: "sent", type: "checkbox", required: true }],
  retries: {
    attempts: 4,
    backoff: { type: "exponential", delay: MINUTE_MS / 2 },
  },
  onFail: logFailure,
  handler: async ({ input }) => {
    if (Date.now() > input.notAfter) return { output: { sent: false } };
    const email = openJobInput(input.sealed, requiredEnv(AUTH_ENV.secret));
    if (!isAuthEmail(email)) throw new Error("Sealed input isn't an email");
    const { sendAuthEmail } = await import("@/lib/auth-email");
    await sendAuthEmail(email);
    return { output: { sent: true } };
  },
};

export const authCleanupTask: TaskConfig<{
  input: object;
  output: { sessions: number; verifications: number; invitations: number };
}> = {
  slug: JOB_TASKS.authCleanup,
  outputSchema: [
    { name: "sessions", type: "number", required: true },
    { name: "verifications", type: "number", required: true },
    { name: "invitations", type: "number", required: true },
  ],
  schedule: dailyMaintenance,
  retries: 2,
  onFail: logFailure,
  handler: async () => {
    const { deleteExpiredAuthRecords } = await import("@__NAME__/auth");
    return { output: await deleteExpiredAuthRecords() };
  },
};

// Expired consent records, plus consent linked to accounts that no longer exist (a safety net
// for erasure jobs that never ran, lib/privacy/erase.ts).
export const consentRetentionTask: TaskConfig<{
  input: object;
  output: { deleted: number; orphanedSubjects: number };
}> = {
  slug: JOB_TASKS.consentRetention,
  outputSchema: [
    { name: "deleted", type: "number", required: true },
    { name: "orphanedSubjects", type: "number", required: true },
  ],
  schedule: dailyMaintenance,
  retries: 2,
  onFail: logFailure,
  handler: async () => {
    const { eraseOrphanedConsentSubjects } = await import(
      "@/lib/privacy/erase"
    );
    return {
      output: {
        deleted: await deleteExpiredConsentRecords(),
        orphanedSubjects: await eraseOrphanedConsentSubjects(),
      },
    };
  },
};

// Payload 3.90 never releases a job whose runner was killed (time limit, crash): it stays
// `processing` forever, and a stuck scheduled task is never scheduled again. Jobs processing
// longer than any run can last are released so they retry; failed ones go after their
// retention, since their input can hold email links (sealed, but still not kept for ever).
export const jobsCleanupTask: TaskConfig<{
  input: object;
  output: { released: number; deleted: number };
}> = {
  slug: JOB_TASKS.jobsCleanup,
  outputSchema: [
    { name: "released", type: "number", required: true },
    { name: "deleted", type: "number", required: true },
  ],
  schedule: [
    {
      ...dailyMaintenance[0],
      hooks: {
        // The default skips scheduling while an earlier run is unfinished, so a stuck cleanup
        // would block every later one. This task releases stuck jobs, its own included.
        beforeSchedule: async ({ req }) => {
          const { totalDocs } = await req.payload.count({
            collection: JOBS_COLLECTION,
            where: {
              and: [
                { taskSlug: { equals: JOB_TASKS.jobsCleanup } },
                { processing: { equals: false } },
                { completedAt: { exists: false } },
                { hasError: { not_equals: true } },
              ],
            },
            req,
          });
          return { shouldSchedule: totalDocs === 0, input: {} };
        },
      },
    },
  ],
  retries: 2,
  onFail: logFailure,
  handler: async ({ job, req }) => {
    const stuckBefore = new Date(
      Date.now() - STUCK_JOB_MINUTES * MINUTE_MS,
    ).toISOString();
    const released = await req.payload.update({
      collection: JOBS_COLLECTION,
      where: {
        and: [
          { id: { not_equals: job.id } },
          { processing: { equals: true } },
          { updatedAt: { less_than: stuckBefore } },
        ],
      },
      data: { processing: false },
      req,
    });
    const failedBefore = new Date(
      Date.now() - FAILED_JOB_RETENTION_DAYS * DAY_MS,
    ).toISOString();
    const { docs } = await req.payload.delete({
      collection: JOBS_COLLECTION,
      where: {
        and: [
          { hasError: { equals: true } },
          { updatedAt: { less_than: failedBefore } },
        ],
      },
      req,
    });
    return {
      output: { released: released.docs.length, deleted: docs.length },
    };
  },
};

// Idle AI conversations (and state whose owner was deleted), see lib/agent-retention.ts.
export const agentThreadsCleanupTask: TaskConfig<{
  input: object;
  output: { threads: number; orphans: number };
}> = {
  slug: JOB_TASKS.agentThreadsCleanup,
  outputSchema: [
    { name: "threads", type: "number", required: true },
    { name: "orphans", type: "number", required: true },
  ],
  schedule: dailyMaintenance,
  retries: 2,
  onFail: logFailure,
  handler: async () => ({ output: await deleteExpiredAgentThreads() }),
};

// After an account is deleted: consent records linked to it and the PostHog person with their
// events (lib/privacy/erase.ts). Retried over about a day, since an erasure request must not be
// lost to a PostHog outage. Both steps are safe to repeat.
export const privacyEraseTask: TaskConfig<{
  input: { userId: string; sealed?: string };
  output: { consentSubjects: number; posthog: string; orders: number };
}> = {
  slug: JOB_TASKS.privacyErase,
  inputSchema: [
    { name: "userId", type: "text", required: true },
    { name: "sealed", type: "text" },
  ],
  outputSchema: [
    { name: "consentSubjects", type: "number", required: true },
    { name: "posthog", type: "text", required: true },
    { name: "orders", type: "number", required: true },
  ],
  retries: {
    attempts: 10,
    backoff: { type: "exponential", delay: MINUTE_MS },
  },
  onFail: logFailure,
  handler: async ({ input }) => {
    const { eraseConsentSubjects, erasePostHogPerson } = await import(
      "@/lib/privacy/erase"
    );
    const { eraseShopData } = await import("@/lib/privacy/erase-shop");
    const opened = input.sealed
      ? openJobInput(input.sealed, requiredEnv(AUTH_ENV.secret))
      : null;
    const email =
      typeof opened === "object" && opened !== null && "email" in opened
        ? String((opened as { email: unknown }).email)
        : null;
    const consent = await eraseConsentSubjects(input.userId);
    const shop = await eraseShopData(input.userId, email);
    const posthog = await erasePostHogPerson(input.userId);
    if (posthog === "not-configured") {
      console.warn(
        "[privacy] PostHog erasure skipped: no personal API key configured",
      );
    }
    return {
      output: {
        consentSubjects: consent.subjects,
        posthog,
        orders: shop.orders,
      },
    };
  },
};

// Audit log partitions: creates the coming months, drops those past retention (@__NAME__/db audit.ts).
export const auditPartitionsTask: TaskConfig<{
  input: object;
  output: { created: number; dropped: number };
}> = {
  slug: JOB_TASKS.auditPartitions,
  outputSchema: [
    { name: "created", type: "number", required: true },
    { name: "dropped", type: "number", required: true },
  ],
  schedule: dailyMaintenance,
  retries: 2,
  onFail: logFailure,
  handler: async () => {
    const { getDb, maintainAuditPartitions } = await import("@__NAME__/db");
    return { output: await maintainAuditPartitions(getDb().$client) };
  },
};

export const JOB_TASK_CONFIGS = [
  cancelSubscriptionsTask,
  sendAuthEmailTask,
  authCleanupTask,
  consentRetentionTask,
  jobsCleanupTask,
  agentThreadsCleanupTask,
  privacyEraseTask,
  auditPartitionsTask,
];
