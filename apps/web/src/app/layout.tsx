import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource-variable/fraunces/index.css";
import "@fontsource-variable/fraunces/wght-italic.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { CheckProvider } from "@/lib/check-store";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    default: `${SITE.name} - ${SITE.tagline}`,
    template: `%s - ${SITE.name}`,
  },
  description: SITE.description,
  referrer: "no-referrer",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4EFE7" },
    { media: "(prefers-color-scheme: dark)", color: "#192025" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="flex min-h-dvh flex-col">
        <a className="skip" href="#main">
          Skip to main content
        </a>
        <SiteHeader />
        <CheckProvider>
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
        </CheckProvider>
        <SiteFooter />
      </body>
    </html>
  );
}
