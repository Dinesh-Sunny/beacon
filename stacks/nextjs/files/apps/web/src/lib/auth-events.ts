import type { AuthEventSink } from "@__NAME__/auth";
import { getDb, recordAuditEvent } from "@__NAME__/db";
import { toAuditEvent } from "@/lib/audit-events";
import { ANALYTICS_EVENTS } from "@/lib/observability/analytics-events";
import { captureServerEvent } from "@/lib/observability/posthog-server";
import { enqueuePrivacyErase } from "@/payload/jobs/enqueue";

// Logs carry only an error's name: messages can echo request data.
function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

// The audit row for an event. A failed write is logged, never thrown: the audit log must not be
// able to block a sign-in or a change.
async function recordAudit(event: Parameters<AuthEventSink>[0]): Promise<void> {
  const audit = toAuditEvent(event);
  if (!audit) return;
  try {
    await recordAuditEvent(getDb().$client, audit);
  } catch (error) {
    console.error("[audit] couldn't record event", {
      action: audit.action,
      error: errorName(error),
    });
  }
}

// Where Better Auth's typed events go: the audit log, analytics, and erasure after deletion.
export const handleAuthEvent: AuthEventSink = async (event) => {
  await recordAudit(event);
  switch (event.type) {
    case "user.created":
      await captureServerEvent({
        distinctId: event.userId,
        event: ANALYTICS_EVENTS.signedUp,
      });
      return;
    case "user.signed_in":
      await captureServerEvent({
        distinctId: event.userId,
        event: ANALYTICS_EVENTS.signedIn,
      });
      return;
    case "user.deleted":
      // The account is already gone, so a failure here can't undo it. Consent records are also
      // swept daily (orphaned subjects, lib/privacy/erase.ts); PostHog and shop data have no sweep,
      // so say so.
      try {
        await enqueuePrivacyErase(event.userId, event.email);
      } catch (error) {
        console.error(
          "[privacy] couldn't queue erasure; PostHog and shop data need manual erasure",
          {
            userId: event.userId,
            error: errorName(error),
          },
        );
      }
      return;
    default:
      return;
  }
};
