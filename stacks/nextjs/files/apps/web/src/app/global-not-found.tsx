import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { FONT_CLASS_NAMES } from "@/lib/fonts";
import { SITE_VIEWPORT } from "@/lib/metadata";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

// Unmatched URLs anywhere in the app. The site and the Payload admin are separate root layouts,
// so no single layout can host a 404; this page brings its own <html>.
export const metadata: Metadata = {
  title: `Page not found · ${SITE.name}`,
  robots: { index: false },
};

export const viewport: Viewport = SITE_VIEWPORT;

export default function GlobalNotFound() {
  return (
    <html
      lang={SITE.language}
      className={cn("h-full", "antialiased", FONT_CLASS_NAMES)}
    >
      <body className="flex min-h-full flex-col">
        <main className="flex flex-1 items-center justify-center p-6">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                <h1 className="text-2xl">Page not found</h1>
              </EmptyTitle>
              <EmptyDescription>
                This address doesn&apos;t match any page on the site.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild size="lg">
                <Link href="/">Go to the homepage</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </main>
      </body>
    </html>
  );
}
