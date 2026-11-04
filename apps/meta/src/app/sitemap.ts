import type { MetadataRoute } from "next";
import { REGISTRY } from "@/engine/rules";
import { SITE_URL } from "@/lib/site";

// Public pages, dated by the rule packs' version so a rules update shows as a change.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = REGISTRY.version
    .match(/\d{4}\.\d{2}\.\d{2}/)?.[0]
    ?.replaceAll(".", "-");
  return ["", "/how"].map((p) => ({
    url: `${SITE_URL}${p}`,
    lastModified,
    changeFrequency: "weekly",
  }));
}
