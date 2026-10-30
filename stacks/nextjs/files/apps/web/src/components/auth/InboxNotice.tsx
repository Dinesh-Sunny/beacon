"use client";

import type { AuthEmailKind } from "@__NAME__/auth/config";
import {
  ArrowUpRight01Icon,
  SourceCodeSquareIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { MailOpenIcon } from "@/components/ui/mail-open";
import { DEV_OUTBOX_ENABLED, devOutboxHref } from "@/lib/dev-outbox";
import { mailProviderFor } from "@/lib/mail-providers";
import { cn } from "@/lib/utils";
import { AnimatedBadge } from "./AnimatedBadge";
import { AuthHeading } from "./AuthHeading";
import { AUTH_SUBMIT } from "./constants";

// "Check your inbox" after any emailed link: an animated envelope, the address, a shortcut to the
// visitor's webmail when we recognise it, and the flow's own follow-ups (resend, change email).
export function InboxNotice({
  email,
  kind,
  title = "Check your inbox",
  children,
  footer,
}: {
  email: string;
  // Which email was sent, so the dev-only shortcut opens that link and no other.
  kind: AuthEmailKind;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const provider = mailProviderFor(email);
  return (
    <div className="flex flex-col gap-6">
      <AuthHeading
        media={
          <AnimatedBadge
            render={(ref) => <MailOpenIcon ref={ref} size={30} />}
          />
        }
        title={title}
        focusOnMount
        description={children}
      />
      {provider && (
        <Button asChild className="pointer-coarse:min-h-11">
          <a href={provider.url} target="_blank" rel="noopener noreferrer">
            Open {provider.name}
            <HugeiconsIcon
              icon={ArrowUpRight01Icon}
              strokeWidth={2}
              data-icon="inline-end"
            />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Button>
      )}
      {DEV_OUTBOX_ENABLED && (
        <Button
          asChild
          variant="secondary"
          size="lg"
          className={cn(AUTH_SUBMIT, "border border-dashed border-border")}
        >
          {/* A plain anchor: the route answers with a redirect, which client navigation can't follow. */}
          <a href={devOutboxHref(kind, email)}>
            <HugeiconsIcon
              icon={SourceCodeSquareIcon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Open the link (dev only)
          </a>
        </Button>
      )}
      {footer}
    </div>
  );
}
