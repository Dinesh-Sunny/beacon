import { Button, Heading, Link, Text } from "react-email";
import { EmailLayout } from "./EmailLayout";

// Words for one email. Copy modules (auth-copy.ts, cms-copy.ts) build these so subjects,
// buttons, and expiry windows stay next to the config they describe. Follows VOICE.md.
export type ActionEmailCopy = {
  subject: string;
  // Inbox preview line shown after the subject.
  preview: string;
  heading: string;
  paragraphs: string[];
  action: string;
  // Reassurance for someone who didn't ask for the email.
  footnote: string;
};

type ActionEmailProps = {
  copy: ActionEmailCopy;
  url: string;
};

// Every email that asks for one click (verify, reset, sign in, accept): heading, short
// explanation, one button, and the raw link for clients that strip buttons. The fallback is
// skipped in the plain-text part, which already prints the button's link.
export function ActionEmail({ copy, url }: ActionEmailProps) {
  return (
    <EmailLayout preview={copy.preview} footnote={copy.footnote}>
      <Heading as="h1" className="m-0 mb-4 font-heading font-semibold text-2xl">
        {copy.heading}
      </Heading>
      {copy.paragraphs.map((paragraph) => (
        <Text key={paragraph} className="m-0 mb-4 text-base text-foreground">
          {paragraph}
        </Text>
      ))}
      <Button
        href={url}
        className="mt-2 mb-6 rounded-md bg-primary px-5 py-3.5 font-medium text-base text-primary-foreground"
      >
        {copy.action}
      </Button>
      <Text data-skip-in-text className="m-0 text-muted-foreground text-sm">
        Button not working? Paste this link into your browser:
      </Text>
      <Link
        data-skip-in-text
        href={url}
        className="break-all text-primary text-sm"
      >
        {url}
      </Link>
    </EmailLayout>
  );
}
