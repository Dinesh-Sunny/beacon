import { cacheLife } from "next/cache";
import { CookieSettingsLink } from "@/components/consent/CookieSettingsLink";
import { CmsLink } from "@/components/site/CmsLink";
import { SITE_CONTAINER } from "@/components/site/Section";
import { getNavigation } from "@/lib/cms";
import type { SiteContext } from "@/lib/tenant";
import { cn } from "@/lib/utils";

// Cached so reading the clock doesn't make every page dynamic; refreshed daily.
async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export async function SiteFooter({ site }: { site: SiteContext }) {
  const { footer } = await getNavigation(site.tenant.id);
  const links = footer ?? [];
  return (
    <footer className="mt-auto border-t">
      <div
        className={cn(
          SITE_CONTAINER,
          "flex flex-col gap-6 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between",
        )}
      >
        {links.length > 0 && (
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {links.map((link) => (
                <li key={link.id ?? link.href}>
                  <CmsLink
                    href={link.href}
                    className="inline-flex min-h-6 items-center rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11"
                  >
                    {link.label}
                  </CmsLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:ml-auto">
          <CookieSettingsLink className="h-auto px-0 font-normal text-muted-foreground" />
          <p>
            © <CopyrightYear /> {site.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
