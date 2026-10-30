import type { Route } from "next";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { parseSiteHref } from "@/lib/site-href";

type CmsLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  // Marks the link for the page being shown (navigation).
  current?: boolean;
  onClick?: () => void;
  // Editors can open a rich-text link in a new tab.
  newTab?: boolean;
  // Set to render the link as a button (hero and call-to-action actions).
  button?: Pick<ComponentProps<typeof Button>, "variant" | "size">;
};

// Renders an editor-entered link. Hrefs are validated on save, but old or imported data is
// checked again here: an unsafe href renders as plain text instead of a link.
export function CmsLink({
  href,
  children,
  className,
  current = false,
  onClick,
  newTab = false,
  button,
}: CmsLinkProps) {
  const parsed = parseSiteHref(href);
  if (!parsed) return <span className={className}>{children}</span>;
  const anchorClassName = button ? undefined : className;
  const ariaCurrent = current ? "page" : undefined;
  const anchor =
    parsed.kind === "internal" ? (
      // Editors type the path, so it can't be checked against the typed route tree.
      <Link
        href={parsed.href as Route}
        className={anchorClassName}
        aria-current={ariaCurrent}
        {...(newTab && { target: "_blank" })}
        onClick={onClick}
      >
        {children}
      </Link>
    ) : (
      <a
        href={parsed.href}
        {...(newTab && { target: "_blank", rel: "noopener noreferrer" })}
        className={anchorClassName}
        onClick={onClick}
      >
        {children}
      </a>
    );
  if (!button) return anchor;
  return (
    <Button asChild {...button} className={className}>
      {anchor}
    </Button>
  );
}
