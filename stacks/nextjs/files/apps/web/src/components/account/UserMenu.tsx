"use client";

import { useConsentManager } from "@c15t/nextjs";
import {
  CookieIcon,
  Logout01Icon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
import { ACCOUNT_NAV } from "@/lib/account-nav";
import { authClient } from "@/lib/auth-client";
import { AUTH_ROUTES } from "@/lib/auth-routes";
import { COOKIE_SETTINGS_LABEL } from "@/lib/consent/consent-copy";
import { resetIdentity } from "@/lib/observability/analytics";
import { UserAvatar } from "./UserAvatar";

function Identity({ name, email }: { name: string; email: string }) {
  return (
    <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
      <span className="truncate font-medium">{name}</span>
      <span className="truncate text-xs text-muted-foreground">{email}</span>
    </span>
  );
}

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const [, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const [you] = ACCOUNT_NAV;
  const { setActiveUI, resetConsents } = useConsentManager();

  function signOut() {
    startTransition(async () => {
      const { error } = await authClient.signOut();
      if (error) {
        setFailed(true);
        return;
      }
      resetIdentity();
      // The next person on this browser makes their own cookie choice, recorded apart from
      // this account's (docs/knowledge/compliance.md).
      resetConsents();
      router.push(AUTH_ROUTES.signIn);
      router.refresh();
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
              <UserAvatar name={name} />
              <Identity name={name} email={email} />
              <HugeiconsIcon
                icon={UnfoldMoreIcon}
                strokeWidth={2}
                className="ml-auto"
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            side={isMobile ? "top" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="flex items-center gap-2 font-normal">
              <UserAvatar name={name} />
              <Identity name={name} email={email} />
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {you.items.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href}>
                    <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                    {item.title}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setActiveUI("dialog")}>
              <HugeiconsIcon icon={CookieIcon} strokeWidth={2} />
              {COOKIE_SETTINGS_LABEL}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={signOut}>
              <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {failed && (
          <p role="alert" className="px-2 pt-2 text-xs text-destructive">
            Sign out didn't finish. Try again.
          </p>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
