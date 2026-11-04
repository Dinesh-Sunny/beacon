import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource-variable/fraunces/index.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { localeInfo } from "@/i18n/locales";
import { I18nProvider } from "@/i18n/Provider";
import { getLocale, invites, messagesFor } from "@/i18n/server";

export const metadata: Metadata = {
  title: {
    default: "Beacon - find the support that's already yours",
    template: "%s · Beacon",
  },
  description:
    "Tell Beacon about your life by typing, speaking or snapping a letter. Its agents find the help and money you're entitled to, warn you about clashes and get you ready to claim.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F4EFE7",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html
      lang={locale === "en" ? "en-GB" : locale}
      dir={localeInfo(locale).dir}
    >
      <body>
        <I18nProvider
          locale={locale}
          messages={messagesFor(locale)}
          invites={invites()}
        >
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
