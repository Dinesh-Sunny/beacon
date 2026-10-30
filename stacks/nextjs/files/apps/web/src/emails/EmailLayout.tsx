import type { ReactNode } from "react";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  pixelBasedPreset,
  Section,
  Tailwind,
  Text,
} from "react-email";
import { SITE } from "@/lib/site";
import { EMAIL_THEME } from "./theme";

type EmailLayoutProps = {
  preview: string;
  children: ReactNode;
  // Small print under the divider (why you got this email).
  footnote: string;
};

// Shared frame for every email: a single centred card on a muted page. Email clients don't
// support rem, so the pixel preset converts Tailwind's scale.
export function EmailLayout({ preview, children, footnote }: EmailLayoutProps) {
  return (
    <Html lang={SITE.language}>
      <Tailwind config={{ presets: [pixelBasedPreset] }} theme={EMAIL_THEME}>
        <Head>
          {/* Light only: without this, Apple Mail and Gmail invert some colors and not others. */}
          <meta name="color-scheme" content="light" />
          <meta name="supported-color-schemes" content="light" />
        </Head>
        <Preview>{preview}</Preview>
        <Body className="m-0 bg-muted py-10 font-sans text-foreground">
          <Container className="mx-auto max-w-xl px-4">
            <Text className="m-0 mb-4 font-semibold text-base text-foreground">
              {SITE.name}
            </Text>
            <Section className="rounded-lg border border-border border-solid bg-background px-6 py-8">
              {children}
              <Hr className="my-6 border-border" />
              <Text className="m-0 text-muted-foreground text-sm">
                {footnote}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
