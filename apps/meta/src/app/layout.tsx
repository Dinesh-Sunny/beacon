import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource-variable/fraunces/index.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { CaptionBar } from "@/components/CaptionBar";
import { Insights } from "@/components/Insights";
import { OfflineNotice } from "@/components/OfflineNotice";
import { localeInfo } from "@/i18n/locales";
import { I18nProvider } from "@/i18n/Provider";
import {
  countriesFor,
  getCountry,
  getLocale,
  invites,
  messagesFor,
} from "@/i18n/server";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Beacon",
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

/** Applies the saved display settings (see lib/display.ts) before the first paint. */
const DISPLAY_SCRIPT = `try{var d=JSON.parse(localStorage.getItem("beacon:display")||"null");if(d){var r=document.documentElement;r.dataset.size=String(d.size??1);(d.on||[]).forEach(function(s){r.dataset[s]="on"})}}catch(e){}`;

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
      // The display script below sets data attributes before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed script, no user data; runs before first paint so display settings never flash
          dangerouslySetInnerHTML={{ __html: DISPLAY_SCRIPT }}
        />
      </head>
      <body>
        <I18nProvider
          locale={locale}
          messages={messagesFor(locale)}
          invites={invites()}
          countries={countriesFor(locale)}
          country={await getCountry()}
        >
          <OfflineNotice />
          <CaptionBar />
          {children}
        </I18nProvider>
        <Insights />
      </body>
    </html>
  );
}
