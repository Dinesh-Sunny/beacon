import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader, SiteHeaderSkeleton } from "@/components/site/SiteHeader";
import { BASE_OPEN_GRAPH, NO_INDEX, ROBOTS } from "@/lib/metadata";
import { getPrerenderHosts, getSiteForParam } from "@/lib/tenant";

const MAIN_ID = "main";

// One prerendered shell per known site host; other hosts render on first visit. Never empty
// (Cache Components requires a param): the configured site's host is always listed.
export async function generateStaticParams(): Promise<Array<{ site: string }>> {
  return (await getPrerenderHosts()).map((site) => ({ site }));
}

// Per-site identity, canonical origin, and indexing (docs/adr/0002-multi-tenancy.md).
export async function generateMetadata({
  params,
}: LayoutProps<"/[site]">): Promise<Metadata> {
  const site = await getSiteForParam((await params).site);
  if (!site) return { robots: NO_INDEX };
  return {
    metadataBase: site.origin,
    title: { default: site.name, template: `%s · ${site.name}` },
    description: site.description,
    applicationName: site.name,
    openGraph: { ...BASE_OPEN_GRAPH, siteName: site.name },
    robots: site.indexable ? ROBOTS : NO_INDEX,
  };
}

async function SiteChrome({
  params,
  part,
}: {
  params: LayoutProps<"/[site]">["params"];
  part: "header" | "footer";
}) {
  const site = await getSiteForParam((await params).site);
  if (!site) notFound();
  return part === "header" ? (
    <SiteHeader site={site} />
  ) : (
    <SiteFooter site={site} />
  );
}

// Public pages of the tenant whose host this request came in on (the host is rewritten into the
// `[site]` segment by next.config.ts). Header and footer stream inside Suspense, so the shell
// stays free of URL data. Account and auth screens sit outside this group.
export default function SiteLayout({
  children,
  params,
}: LayoutProps<"/[site]">) {
  return (
    <>
      <a
        href={`#${MAIN_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <Suspense fallback={<SiteHeaderSkeleton />}>
        <SiteChrome params={params} part="header" />
      </Suspense>
      <main id={MAIN_ID} className="flex flex-1 flex-col">
        {children}
      </main>
      <Suspense>
        <SiteChrome params={params} part="footer" />
      </Suspense>
    </>
  );
}
