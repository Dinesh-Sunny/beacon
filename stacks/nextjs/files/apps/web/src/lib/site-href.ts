import { isSafeRelativePath } from "./safe-path.ts";

// Hrefs editors may put on CMS links: a same-site path, an https URL, or a mailto address. Pure
// (no framework imports) so Payload validation, the renderer, and `node --test` share it.
// Anything else (javascript:, data:, http:) is rejected before it reaches a page.
export type SiteHref =
  | { kind: "internal"; href: string }
  | { kind: "external"; href: string };

const EXTERNAL_PROTOCOLS = new Set(["https:", "mailto:"]);

export function parseSiteHref(value: string): SiteHref | null {
  const href = value.trim();
  if (isSafeRelativePath(href)) return { kind: "internal", href };
  try {
    const url = new URL(href);
    if (!EXTERNAL_PROTOCOLS.has(url.protocol)) return null;
    if (url.protocol === "https:" && !url.hostname) return null;
    return { kind: "external", href: url.toString() };
  } catch {
    return null;
  }
}
