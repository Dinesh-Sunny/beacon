import { EMAIL_KIND_TAG, EMAIL_TAG_PATTERN } from "./config.ts";

// A rendered email, independent of any provider. Templates render to this; transports send it.
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  // Plain-text part. Templates always render one; some third-party senders (Payload) send HTML only.
  text?: string;
  // Template name, sent as the SES `kind` tag (letters, numbers, `_`, `-`).
  kind: string;
  // Extra SES tags (tenant, order) for splitting delivery events. Same character rules.
  tags?: Readonly<Record<string, string>>;
  // Overrides the mailer's default sender (per-tenant domains later).
  from?: string;
  replyTo?: string;
};

export type SentEmail = {
  // Provider message id; the dev transport returns a local one.
  messageId: string;
};

export type Mailer = {
  // Which transport is active; shown in logs.
  readonly transport: "ses" | "dev";
  send: (message: EmailMessage) => Promise<SentEmail>;
};

export class EmailConfigError extends Error {
  override name = "EmailConfigError";
}

export class EmailNotConfiguredError extends EmailConfigError {
  override name = "EmailNotConfiguredError";
}

// Tag names and values SES would reject, plus a `kind` tag set twice.
export function validateMessage(message: EmailMessage): void {
  const tags = Object.entries(message.tags ?? {});
  if (tags.some(([name]) => name === EMAIL_KIND_TAG)) {
    throw new EmailConfigError(
      `Use message.kind, not a "${EMAIL_KIND_TAG}" tag`,
    );
  }
  for (const value of [message.kind, ...tags.flat()]) {
    if (!EMAIL_TAG_PATTERN.test(value)) {
      throw new EmailConfigError(`Invalid email tag or kind: ${value}`);
    }
  }
}
