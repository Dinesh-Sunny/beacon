"use client";

import {
  CheckmarkCircle02Icon,
  PlusSignIcon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { roleLabel } from "@/lib/org-roles";
import { CreateOrganizationDialog } from "./CreateOrganizationDialog";
import { OrgAvatar } from "./OrgAvatar";

type Org = { id: string; name: string };
type ActiveOrg = Org & { role: string | null };

// Which organization the team and key pages act for. Switching sets the session's active org.
export function OrgSwitcher({
  organizations,
  active,
}: {
  organizations: Org[];
  active: ActiveOrg | null;
}) {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function switchTo(org: Org) {
    if (org.id === active?.id) return;
    setError(null);
    startTransition(async () => {
      const { error: failed } = await authClient.organization.setActive({
        organizationId: org.id,
      });
      if (failed) setError(authErrorMessage(failed));
      else router.refresh();
    });
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground"
            >
              {active ? (
                <OrgAvatar name={active.name} />
              ) : (
                <span className="flex size-8 items-center justify-center rounded-lg border border-dashed">
                  <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
                </span>
              )}
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate font-medium">
                  {active?.name ?? "No organization"}
                </span>
                {active?.role && (
                  <span className="truncate text-xs text-muted-foreground">
                    {roleLabel(active.role)}
                  </span>
                )}
              </span>
              {pending ? (
                <Spinner className="motion-reduce:animate-none" />
              ) : (
                <HugeiconsIcon
                  icon={UnfoldMoreIcon}
                  strokeWidth={2}
                  className="ml-auto"
                />
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            {organizations.length > 0 && (
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Organizations
              </DropdownMenuLabel>
            )}
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onSelect={() => switchTo(org)}
                className="gap-2"
              >
                <OrgAvatar name={org.name} />
                <span className="truncate">{org.name}</span>
                {org.id === active?.id && (
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    strokeWidth={2}
                    className="ml-auto text-primary"
                  />
                )}
                {org.id === active?.id && (
                  <span className="sr-only"> (current)</span>
                )}
              </DropdownMenuItem>
            ))}
            {organizations.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onSelect={() => setCreating(true)}
              className="gap-2"
            >
              <span className="flex size-8 items-center justify-center rounded-lg border">
                <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
              </span>
              Create organization
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {error && (
          <p role="alert" className="px-2 pt-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <CreateOrganizationDialog open={creating} onOpenChange={setCreating} />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
