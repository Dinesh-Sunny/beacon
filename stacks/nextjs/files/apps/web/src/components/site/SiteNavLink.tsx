"use client";

import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { CmsLink } from "@/components/site/CmsLink";
import { parseSiteHref } from "@/lib/site-href";

// A navigation link that knows when it points at the page being shown.
export function SiteNavLink(
  props: Omit<ComponentProps<typeof CmsLink>, "current">,
) {
  const pathname = usePathname();
  const parsed = parseSiteHref(props.href);
  const current =
    parsed?.kind === "internal" &&
    new URL(parsed.href, "https://site.invalid").pathname === pathname;
  return <CmsLink {...props} current={current} />;
}
