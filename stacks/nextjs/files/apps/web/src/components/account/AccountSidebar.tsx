"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import type { AccountContext } from "@/lib/account";
import { ACCOUNT_NAV, activeAccountItem } from "@/lib/account-nav";
import { OrgSwitcher } from "./OrgSwitcher";
import { UserMenu } from "./UserMenu";

export function AccountSidebar({
  context,
}: {
  context: Pick<AccountContext, "organizations" | "activeOrganization"> & {
    user: { name: string; email: string };
  };
}) {
  const pathname = usePathname();
  const active = activeAccountItem(pathname);
  // On phones the sidebar is a sheet; picking a page should reveal it, not leave the sheet open.
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <OrgSwitcher
          organizations={context.organizations}
          active={context.activeOrganization}
        />
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Account">
          {ACCOUNT_NAV.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const current = item.href === active.href;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={current}
                          tooltip={item.title}
                          className="pointer-coarse:h-11"
                        >
                          <Link
                            href={item.href}
                            aria-current={current ? "page" : undefined}
                            onClick={() => {
                              if (isMobile) setOpenMobile(false);
                            }}
                          >
                            <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter>
        <UserMenu name={context.user.name} email={context.user.email} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
