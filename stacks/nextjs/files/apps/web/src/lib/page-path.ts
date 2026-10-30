import type { Route } from "next";
import { HOME_SLUG } from "../payload/constants.ts";

// The URL a published CMS page lives at: the home page is `/`. Pure (no Next or Payload runtime),
// so the Payload config, Markdown, and tests can all use it.
export function pagePath(slug: string): Route {
  return (slug === HOME_SLUG ? "/" : `/${slug}`) as Route;
}

// Where agents get the same page as Markdown (llms.txt links here; next.config.ts rewrites
// `/<slug>.md` and `Accept: text/markdown` requests to the /md route).
export const MARKDOWN_ROUTE = "/md";
export const MARKDOWN_SUFFIX = ".md";
// The home page's Markdown name; Next also hands `/` to rewrites as `index`.
export const INDEX_SEGMENT = "index";
export const HOME_MARKDOWN_PATH = `/${INDEX_SEGMENT}${MARKDOWN_SUFFIX}`;

export function markdownPath(slug: string): string {
  return slug === HOME_SLUG ? HOME_MARKDOWN_PATH : `/${slug}${MARKDOWN_SUFFIX}`;
}
