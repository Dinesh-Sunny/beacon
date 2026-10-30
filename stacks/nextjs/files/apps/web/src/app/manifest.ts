import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { getSiteForRequest } from "@/lib/tenant";
import { themeColor } from "@/lib/theme-colors";

// Named after the site this request's host belongs to (icons stay the base ones for now).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const site = await getSiteForRequest();
  const name = site?.name ?? SITE.name;
  return {
    name,
    short_name: name,
    description: site?.description ?? SITE.description,
    lang: SITE.language,
    start_url: "/",
    display: "standalone",
    background_color: themeColor("background"),
    theme_color: themeColor("background"),
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
