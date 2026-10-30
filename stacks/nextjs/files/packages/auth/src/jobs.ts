// Work @__NAME__/auth hands to the app's job queue, so it is retried and recorded instead of only
// logged. The package stays queue-agnostic: apps/web maps each job to a Payload task.
import type { AuthEmail } from "./email.ts";

export type AuthJob =
  // Stop billing for organizations that were deleted.
  | { type: "cancel-subscriptions"; stripeSubscriptionIds: string[] }
  // An auth email that failed to send the first time; not sent after `notAfter` (epoch ms),
  // when its link stops working.
  | { type: "send-email"; email: AuthEmail; notAfter: number };

export type EnqueueAuthJob = (job: AuthJob) => Promise<void>;
