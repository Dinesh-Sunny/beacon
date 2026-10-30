import type { Metadata, Route, Viewport } from "next";
import { OG_IMAGE_SIZE, OG_ROUTE } from "@/lib/og";
import { IS_INDEXABLE, SITE } from "@/lib/site";
import { themeColor } from "@/lib/theme-colors";

const twitterHandles = SITE.twitterHandle
  ? { site: SITE.twitterHandle, creator: SITE.twitterHandle }
  : {};

// Next shallow-merges metadata per key, so a page that sets `openGraph` replaces the root's whole
// object. Shared OG/Twitter fields live here and every page spreads them back in via pageMetadata().
export const BASE_OPEN_GRAPH = {
  type: "website",
  siteName: SITE.name,
  locale: SITE.locale,
} satisfies Metadata["openGraph"];

export const BASE_TWITTER = {
  card: "summary_large_image",
  ...twitterHandles,
} satisfies Metadata["twitter"];

export const ROBOTS: Metadata["robots"] = IS_INDEXABLE
  ? {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    }
  : { index: false, follow: false };

export const NO_INDEX: Metadata["robots"] = { index: false, follow: false };

type PageMetadataInput = {
  title: string;
  // Omitted: the site description. null: none (a CMS page without one shouldn't borrow it).
  description?: string | null;
  path: Route;
  noIndex?: boolean;
  // The social card (an /og route, lib/og.ts). Omitted: the site's home card.
  image?: string;
};

// Per-page metadata with a canonical URL and OG/Twitter cards that keep the site-wide fields.
// Relative URLs resolve against metadataBase (set in the root layout).
export function pageMetadata({
  title,
  description = SITE.description,
  path,
  noIndex = false,
  image = OG_ROUTE,
}: PageMetadataInput): Metadata {
  const text = description ?? undefined;
  const images = [{ url: image, ...OG_IMAGE_SIZE, alt: title }];
  return {
    title,
    description: text,
    alternates: { canonical: path },
    openGraph: {
      ...BASE_OPEN_GRAPH,
      title,
      description: text,
      url: path,
      images,
    },
    twitter: { ...BASE_TWITTER, title, description: text, images },
    ...(noIndex && { robots: NO_INDEX }),
  };
}

// Light only until a theme switcher sets the `.dark` class; add a dark entry alongside it then.
// Shared by every root layout (the site and the global 404).
export const SITE_VIEWPORT: Viewport = {
  themeColor: themeColor("background"),
  colorScheme: "light",
};
