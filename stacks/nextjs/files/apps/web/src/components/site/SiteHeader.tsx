import Link from "next/link";
import { Suspense } from "react";
import { HeaderAccountAction } from "@/components/site/HeaderAccountAction";
import { MobileNav } from "@/components/site/MobileNav";
import { SITE_CONTAINER } from "@/components/site/Section";
import { SiteNavLink } from "@/components/site/SiteNavLink";
import { Skeleton } from "@/components/ui/skeleton";
import { getNavigation } from "@/lib/cms";
import type { SiteContext } from "@/lib/tenant";
import { cn } from "@/lib/utils";

export function SiteHeaderSkeleton() {
  return (
    <div
      className="sticky top-0 z-40 h-16 border-b bg-background"
      aria-hidden="true"
    />
  );
}

export async function SiteHeader({ site }: { site: SiteContext }) {
  const { header } = await getNavigation(site.tenant.id);
  const links = header ?? [];
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-md supports-backdrop-filter:bg-background/90">
      <div className={cn(SITE_CONTAINER, "flex h-16 items-center gap-6")}>
        <Link
          href="/"
          className="inline-flex items-center rounded-md font-heading text-lg font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11"
        >
          {site.name}
        </Link>
        {links.length > 0 && (
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {links.map((link) => (
                <li key={link.id ?? link.href}>
                  <SiteNavLink
                    href={link.href}
                    button={{ variant: "ghost", size: "sm" }}
                    className="text-muted-foreground hover:text-foreground aria-current-page:text-foreground"
                  >
                    {link.label}
                  </SiteNavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2">
          {/* Reads the session, so it streams in without making the page dynamic. */}
          <Suspense fallback={<Skeleton className="h-8 w-20 rounded-md" />}>
            <HeaderAccountAction site={site} />
          </Suspense>
          {links.length > 0 && <MobileNav links={links} />}
        </div>
      </div>
    </header>
  );
}
