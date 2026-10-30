import { AUTH_ENV, type AuthJob } from "@__NAME__/auth";
import { getPayloadClient } from "@/lib/payload";
import { JOB_QUEUES, JOB_TASKS } from "@/payload/constants";
import { sealJobInput } from "@/payload/jobs/sealed-input";

// Account deletion reaches consent records, analytics, and shop orders through a retried job.
// The email (to find guest orders) is sealed: job input is stored until the job completes.
export async function enqueuePrivacyErase(
  userId: string,
  email: string,
): Promise<void> {
  const secret = process.env[AUTH_ENV.secret];
  if (!secret) throw new Error(`${AUTH_ENV.secret} is not set`);
  const payload = await getPayloadClient();
  await payload.jobs.queue({
    task: JOB_TASKS.privacyErase,
    input: { userId, sealed: sealJobInput({ email }, secret) },
    queue: JOB_QUEUES.default,
  });
}

// Maps @__NAME__/auth's retryable work onto Payload tasks. Picked up by the next cron run.
export async function enqueueAuthJob(job: AuthJob): Promise<void> {
  const payload = await getPayloadClient();
  switch (job.type) {
    case "cancel-subscriptions":
      await payload.jobs.queue({
        task: JOB_TASKS.cancelSubscriptions,
        input: { stripeSubscriptionIds: job.stripeSubscriptionIds },
        queue: JOB_QUEUES.default,
      });
      return;
    case "send-email": {
      const secret = process.env[AUTH_ENV.secret];
      if (!secret) throw new Error(`${AUTH_ENV.secret} is not set`);
      await payload.jobs.queue({
        task: JOB_TASKS.sendAuthEmail,
        // Only the kind stays readable: the address and the token-bearing link are sealed.
        input: {
          kind: job.email.kind,
          sealed: sealJobInput(job.email, secret),
          notAfter: job.notAfter,
        },
        queue: JOB_QUEUES.default,
      });
      return;
    }
  }
}
