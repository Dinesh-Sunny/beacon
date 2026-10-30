import {
  type Address,
  EmailConfigError,
  type EmailMessage,
  emailSender,
  parseAddress,
  parseAddressList,
} from "@__NAME__/email";
import type { PayloadEmailAdapter, SendEmailOptions } from "payload";
import { getMailer } from "@/lib/mailer";
import { SITE } from "@/lib/site";
import { PAYLOAD_EMAIL_KIND } from "@/payload/constants";

type AddressField = SendEmailOptions["to"];
type AddressEntry = string | { address: string; name?: string };

// Shown in the admin only; locally the dev transport never sends from it.
const LOCAL_SENDER = "no-reply@localhost";

// Payload's own emails (editor password resets, anything plugins send) go through the same mailer
// as app emails, so one SES setup covers both. The sender is always the mailer's EMAIL_FROM;
// Payload only shows these defaults in its admin.
export const payloadEmailAdapter: PayloadEmailAdapter = () => {
  const sender = emailSender() ?? { address: LOCAL_SENDER };
  return {
    name: "__NAME__-mailer",
    defaultFromName: sender.name ?? SITE.name,
    defaultFromAddress: sender.address,
    sendEmail: async (options) => {
      if (options.attachments?.length) {
        // The SES transport sends simple messages; attachments need a raw MIME path first.
        throw new EmailConfigError("Email attachments aren't supported yet");
      }
      const html = String(options.html ?? "");
      const text =
        typeof options.text === "string"
          ? options.text
          : (await import("@/emails/plain-text")).htmlToText(html);
      const base = {
        subject: String(options.subject ?? ""),
        html,
        text,
        kind: PAYLOAD_EMAIL_KIND,
        replyTo: addresses(options.replyTo)[0]?.address,
      } satisfies Omit<EmailMessage, "to">;
      // One message per recipient (cc and bcc included), so addresses never see each other.
      const recipients = [options.to, options.cc, options.bcc].flatMap(
        addresses,
      );
      const mailer = getMailer();
      return Promise.all(
        recipients.map(({ address }) => mailer.send({ ...base, to: address })),
      );
    },
  };
};

function addresses(field: AddressField): Address[] {
  if (!field) return [];
  const entries: AddressEntry[] = Array.isArray(field) ? field : [field];
  return entries.flatMap((entry) =>
    typeof entry === "string"
      ? parseAddressList(entry)
      : [parseAddress(entry.address)],
  );
}
