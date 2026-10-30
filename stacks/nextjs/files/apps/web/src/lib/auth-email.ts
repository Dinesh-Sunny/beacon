import { recordDevEmail, type SendAuthEmail } from "@__NAME__/auth";
import { renderAuthEmail } from "@/emails/render";
import { DEV_OUTBOX_ENABLED } from "@/lib/dev-outbox";
import { getMailer } from "@/lib/mailer";

// Every auth email: render the template, then send through the mailer (SES, or the server log in
// development). Dev builds also keep the link for the inbox screens' outbox shortcut.
export const sendAuthEmail: SendAuthEmail = async (email) => {
  if (DEV_OUTBOX_ENABLED) recordDevEmail(email);
  await getMailer().send(await renderAuthEmail(email));
};
