import { C15tPrefetch } from "@c15t/nextjs";
import type { Metadata, Viewport } from "next";
import "../globals.css";
import { ConsentManager } from "@/components/consent/ConsentManager";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CONSENT_API_PATH } from "@/lib/consent/config";
import { FONT_CLASS_NAMES } from "@/lib/fonts";
import {
  BASE_OPEN_GRAPH,
  BASE_TWITTER,
  ROBOTS,
  SITE_VIEWPORT,
} from "@/lib/metadata";
import { SITE, SITE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  // No site-wide canonical or og:url: children inherit them, so every page would claim to be the
  // homepage. Pages set their own through pageMetadata().
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: SITE.name,
    description: SITE.description,
  },
  twitter: { ...BASE_TWITTER, title: SITE.name, description: SITE.description },
  robots: ROBOTS,
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = SITE_VIEWPORT;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang={SITE.language}
      className={cn("h-full", "antialiased", FONT_CLASS_NAMES)}
    >
      <head>
        {/* Starts the consent /init request before hydration, so the banner doesn't arrive late
            and pages stay static. */}
        <C15tPrefetch backendURL={CONSENT_API_PATH} />
      </head>
      <body className="min-h-full flex flex-col">
        <ConsentManager>
          <MotionProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </MotionProvider>
        </ConsentManager>
      </body>
    </html>
  );
}
