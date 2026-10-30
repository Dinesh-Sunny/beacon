import type { AuthEmail } from "@__NAME__/auth";
import type { EmailMessage } from "@__NAME__/email";
import { render } from "react-email";
import { ActionEmail, type ActionEmailCopy } from "./ActionEmail";
import { authEmailCopy } from "./auth-copy";
import { HTML_TO_TEXT_OPTIONS } from "./plain-text";

type ActionEmailInput = {
  to: string;
  kind: string;
  copy: ActionEmailCopy;
  url: string;
};

// HTML only, for senders that take markup and add their own envelope (Payload).
export function renderActionHtml(
  copy: ActionEmailCopy,
  url: string,
): Promise<string> {
  return render(<ActionEmail copy={copy} url={url} />);
}

// A ready-to-send message: HTML plus a plain-text part for clients and spam filters that
// prefer it.
export async function renderActionEmail({
  to,
  kind,
  copy,
  url,
}: ActionEmailInput): Promise<EmailMessage> {
  const template = <ActionEmail copy={copy} url={url} />;
  const [html, text] = await Promise.all([
    render(template),
    render(template, {
      plainText: true,
      htmlToTextOptions: HTML_TO_TEXT_OPTIONS,
    }),
  ]);
  return { to, subject: copy.subject, html, text, kind };
}

export function renderAuthEmail(email: AuthEmail): Promise<EmailMessage> {
  return renderActionEmail({
    to: email.to,
    kind: email.kind,
    copy: authEmailCopy(email),
    url: email.url,
  });
}
