import { randomUUID } from "node:crypto";
import type { Mailer } from "./message.ts";

// Local development: no mail server, so the plain-text body (which carries any links) goes to the
// server log. The text can hold sign-in tokens, so createMailer never picks this in production.
export const devTransport: Mailer = {
  transport: "dev",
  send: async (message) => {
    console.info(
      `[email] ${message.kind} → ${message.to}\n  Subject: ${message.subject}\n${indent(message.text ?? message.html)}`,
    );
    return { messageId: `dev-${randomUUID()}` };
  },
};

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}
