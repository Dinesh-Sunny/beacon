// Social card URLs. Cards are served by one host-aware route (app/og/[[...slug]]/route.tsx)
// rather than opengraph-image files under `[site]`: Next puts the host segment into a file
// image's URL, which the host rewrite would then double. Pure.
export const OG_ROUTE = "/og";

// Satori's canvas: the standard 1200x630 social card.
export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

// A CMS page's card; `version` (its last update) makes a new title a new URL for crawlers.
export function ogImagePath(slug: string | null, version?: string): string {
  const path = slug ? `${OG_ROUTE}/${encodeURIComponent(slug)}` : OG_ROUTE;
  return version ? `${path}?v=${encodeURIComponent(version)}` : path;
}
