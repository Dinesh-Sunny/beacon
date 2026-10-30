import { createMailer, type Mailer } from "@__NAME__/email";

let instance: Mailer | undefined;

// Lazy so `next build` never needs email env vars; production throws on first send if SES isn't
// configured (see docs/knowledge/email.md).
export function getMailer(): Mailer {
  instance ??= createMailer();
  return instance;
}
