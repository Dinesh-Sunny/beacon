import { AUTH_ROUTES } from "@/lib/auth-routes";
import { INDEX_SEGMENT, MARKDOWN_ROUTE } from "@/lib/page-path";
import {
  PRIVATE_PATH_PREFIXES,
  PRIVATE_ROUTES,
  PUBLIC_ROUTES,
} from "@/lib/site";
import { APP_PATH_PREFIXES } from "@/lib/site-host";

// Route files next to the site's pages (icon.tsx, opengraph-image.tsx, …) and the Markdown
// route, which a CMS slug would otherwise shadow or be shadowed by.
const FILE_ROUTE_SEGMENTS = [
  "icon",
  "apple-icon",
  "opengraph-image",
  MARKDOWN_ROUTE,
  INDEX_SEGMENT,
] as const;

function firstSegment(path: string): string {
  return path.split("/").filter(Boolean)[0] ?? "";
}

// First path segments that already belong to code routes. A CMS page with one of these slugs
// would never render (the code route wins) yet would still be listed in the sitemap.
export const RESERVED_SLUGS: ReadonlySet<string> = new Set(
  [
    ...PUBLIC_ROUTES.map(({ path }) => path),
    ...PRIVATE_ROUTES,
    ...PRIVATE_PATH_PREFIXES,
    ...Object.values(AUTH_ROUTES),
    ...FILE_ROUTE_SEGMENTS,
    // Every app prefix the host rewrite skips (api, og, md, …) can't be a page either.
    ...APP_PATH_PREFIXES,
  ]
    .map(firstSegment)
    .filter(Boolean),
);
