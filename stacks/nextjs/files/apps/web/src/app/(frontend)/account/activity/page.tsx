import {
  AUDIT_CATEGORIES,
  type AuditCategory,
  auditCategoryOf,
} from "@__NAME__/db";
import { AUDIT_RETENTION_MONTHS } from "@__NAME__/db/config";
import {
  Activity01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  LockPasswordIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { AccountPageSkeleton } from "@/components/account/AccountPageSkeleton";
import { CreateOrganizationButton } from "@/components/account/CreateOrganizationButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { loadActivity } from "@/lib/account";
import { encodeAuditCursor, parseAuditCursor } from "@/lib/audit-cursor";
import {
  AUDIT_CATEGORY_LABELS,
  auditActorName,
  describeAuditEvent,
} from "@/lib/audit-labels";
import { AUTH_ROUTES } from "@/lib/auth-routes";
import { formatDateTime } from "@/lib/format";
import { pageMetadata } from "@/lib/metadata";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({
  title: "Activity",
  path: AUTH_ROUTES.accountActivity,
  noIndex: true,
});

const CATEGORY_PARAM = "category";
const CURSOR_PARAM = "before";

function parseCategory(value: unknown): AuditCategory | null {
  return AUDIT_CATEGORIES.find((category) => category === value) ?? null;
}

function activityHref(params: {
  category: AuditCategory | null;
  before?: string;
}): Route {
  const query = new URLSearchParams();
  if (params.category) query.set(CATEGORY_PARAM, params.category);
  if (params.before) query.set(CURSOR_PARAM, params.before);
  const search = query.toString();
  return (
    search
      ? `${AUTH_ROUTES.accountActivity}?${search}`
      : AUTH_ROUTES.accountActivity
  ) as Route;
}

function ActivityEmpty({
  title,
  description,
  action,
  icon = Activity01Icon,
  className,
}: {
  className?: string;
  title: string;
  description: string;
  action?: ReactNode;
  icon?: typeof Activity01Icon;
}) {
  return (
    <Empty className={cn("border", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={icon} strokeWidth={2} />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

// Category links rather than a client toggle: each view has its own URL and needs no JavaScript.
function CategoryFilter({
  current,
  onFirstPage,
}: {
  current: AuditCategory | null;
  onFirstPage: boolean;
}) {
  const options = [null, ...AUDIT_CATEGORIES] as const;
  return (
    <nav aria-label="Filter by category" className="px-6">
      {/* Pulled left by the buttons' padding so the labels line up with the card title. */}
      <ul className="-ml-2.5 flex flex-wrap gap-1">
        {options.map((category) => {
          const active = category === current;
          return (
            <li key={category ?? "all"}>
              <Button
                asChild
                size="sm"
                variant={active ? "secondary" : "ghost"}
                className={cn(
                  "pointer-coarse:min-h-11",
                  !active && "text-muted-foreground",
                )}
              >
                <Link
                  href={activityHref({ category })}
                  aria-current={active && onFirstPage ? "page" : undefined}
                >
                  {category ? AUDIT_CATEGORY_LABELS[category] : "All"}
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

async function Activity({ searchParams }: PageProps<"/account/activity">) {
  const params = await searchParams;
  const category = parseCategory(params[CATEGORY_PARAM]);
  const cursor = parseAuditCursor(params[CURSOR_PARAM]);
  const activity = await loadActivity(AUTH_ROUTES.accountActivity, {
    category,
    cursor,
  });
  const header = (
    <AccountPageHeader
      title="Activity"
      description={
        activity
          ? `Who changed what in ${activity.organization.name}. Kept for ${AUDIT_RETENTION_MONTHS} months.`
          : `Who changed what in an organization. Kept for ${AUDIT_RETENTION_MONTHS} months.`
      }
    />
  );

  if (!activity) {
    return (
      <>
        {header}
        <ActivityEmpty
          title="Activity belongs to an organization"
          description="Create one, and changes to its members, keys, and billing show up here."
          action={<CreateOrganizationButton />}
        />
      </>
    );
  }

  if (!activity.page) {
    return (
      <>
        {header}
        <ActivityEmpty
          icon={LockPasswordIcon}
          title="Owners and admins see activity"
          description={`Ask an owner or admin of ${activity.organization.name} if you need to check a change.`}
        />
      </>
    );
  }

  const { events, next } = activity.page;
  const names = activity.names;

  return (
    <>
      {header}
      {/* The table and footer run to the card's edge; only an empty view keeps its padding. */}
      <Card className={cn(events.length > 0 && "pb-0")}>
        <CardHeader>
          <CardTitle>
            <h2>{cursor ? "Older events" : "Recent events"}</h2>
          </CardTitle>
          <CardDescription>Newest first. Times are UTC.</CardDescription>
        </CardHeader>
        <CategoryFilter current={category} onFirstPage={!cursor} />
        {events.length === 0 ? (
          <ActivityEmpty
            className="border-0"
            title={category ? "Nothing in this category" : "No activity yet"}
            description={
              category
                ? "Nothing has changed here yet."
                : "Invitations, role changes, API keys, and billing changes show up here."
            }
            action={
              category && (
                <Button asChild variant="outline">
                  <Link href={activityHref({ category: null })}>
                    Show all activity
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden pl-6 sm:table-cell">
                  When
                </TableHead>
                <TableHead className="pl-6 sm:pl-2">Who</TableHead>
                <TableHead>What</TableHead>
                <TableHead className="hidden pr-6 md:table-cell">
                  Category
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => {
                const eventCategory = auditCategoryOf(event.action);
                return (
                  <TableRow key={event.id}>
                    <TableCell className="hidden pl-6 align-top text-muted-foreground tabular-nums whitespace-nowrap sm:table-cell">
                      <time dateTime={new Date(event.occurredAt).toISOString()}>
                        {formatDateTime(event.occurredAt)}
                      </time>
                    </TableCell>
                    <TableCell className="pl-6 align-top sm:pl-2">
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium">
                          {auditActorName(event, names)}
                        </span>
                        {/* Phones drop the When column; the time sits under the name. */}
                        <time
                          dateTime={new Date(event.occurredAt).toISOString()}
                          className="text-xs text-muted-foreground tabular-nums sm:hidden"
                        >
                          {formatDateTime(event.occurredAt)}
                        </time>
                      </span>
                    </TableCell>
                    <TableCell className="pr-6 align-top whitespace-normal md:pr-2">
                      {describeAuditEvent(event, names)}
                    </TableCell>
                    <TableCell className="hidden pr-6 align-top md:table-cell">
                      {eventCategory && (
                        <Badge variant="outline">
                          {AUDIT_CATEGORY_LABELS[eventCategory]}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {events.length > 0 && (cursor || next) && (
          <CardFooter className="justify-between border-t py-4">
            {cursor ? (
              <Button
                asChild
                variant="ghost"
                className="pointer-coarse:min-h-11"
              >
                <Link href={activityHref({ category })}>
                  <HugeiconsIcon
                    icon={ArrowLeft01Icon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
                  Newest
                </Link>
              </Button>
            ) : (
              <span />
            )}
            {next && (
              <Button
                asChild
                variant="outline"
                className="pointer-coarse:min-h-11"
              >
                <Link
                  href={activityHref({
                    category,
                    before: encodeAuditCursor(next),
                  })}
                >
                  Older
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    strokeWidth={2}
                    data-icon="inline-end"
                  />
                </Link>
              </Button>
            )}
          </CardFooter>
        )}
      </Card>
    </>
  );
}

export default function ActivityPage(props: PageProps<"/account/activity">) {
  return (
    <Suspense fallback={<AccountPageSkeleton />}>
      <Activity {...props} />
    </Suspense>
  );
}
