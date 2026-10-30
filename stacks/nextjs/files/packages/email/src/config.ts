// Single source of truth for email settings shared by the mailer, apps, and tests.

export const EMAIL_ENV = {
  // Sender for every message, e.g. `__NAME__ <hello@mail.example.com>`. The domain must be a
  // verified SES identity in the region below.
  from: "EMAIL_FROM",
  // Optional Reply-To, e.g. a monitored support inbox.
  replyTo: "EMAIL_REPLY_TO",
  // Region of the SES identity. Setting it (with EMAIL_FROM) switches sending to SES.
  sesRegion: "AWS_SES_REGION",
  // Optional configuration set: routes delivery, bounce, and complaint events to a destination.
  sesConfigurationSet: "AWS_SES_CONFIGURATION_SET",
} as const;

// SES message tag carrying the email kind, so events and metrics split by template.
export const EMAIL_KIND_TAG = "kind";

// SES tag names and values allow only ASCII letters, numbers, underscores, and dashes. Every
// transport enforces it, so a bad kind fails in development, not on the first real send.
export const EMAIL_TAG_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
