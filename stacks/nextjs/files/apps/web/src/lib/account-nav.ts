import {
  Activity01Icon,
  AiChat02Icon,
  CreditCardIcon,
  Key01Icon,
  SecurityLockIcon,
  UserCircleIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { Route } from "next";
import { AUTH_ROUTES } from "./auth-routes";

export type AccountNavItem = {
  title: string;
  href: Route;
  icon: IconSvgElement;
};

// The account app's pages, grouped as the sidebar shows them. Breadcrumbs read the same list.
export const ACCOUNT_NAV = [
  {
    label: "You",
    items: [
      { title: "Profile", href: AUTH_ROUTES.account, icon: UserCircleIcon },
      {
        title: "Security",
        href: AUTH_ROUTES.accountSecurity,
        icon: SecurityLockIcon,
      },
      {
        title: "Assistant",
        href: AUTH_ROUTES.accountAssistant,
        icon: AiChat02Icon,
      },
    ],
  },
  {
    label: "Organization",
    items: [
      { title: "Team", href: AUTH_ROUTES.accountTeam, icon: UserGroupIcon },
      { title: "API keys", href: AUTH_ROUTES.accountApiKeys, icon: Key01Icon },
      {
        title: "Billing",
        href: AUTH_ROUTES.accountBilling,
        icon: CreditCardIcon,
      },
      {
        title: "Activity",
        href: AUTH_ROUTES.accountActivity,
        icon: Activity01Icon,
      },
    ],
  },
] as const satisfies ReadonlyArray<{
  label: string;
  items: ReadonlyArray<AccountNavItem>;
}>;

// Pages below a nav item, for the last breadcrumb.
const NESTED_TITLES: Partial<Record<Route, string>> = {
  [AUTH_ROUTES.twoFactorSetup]: "Two-factor setup",
};

export function nestedAccountTitle(pathname: string): string | undefined {
  return NESTED_TITLES[pathname as Route];
}

const [
  {
    items: [PROFILE],
  },
] = ACCOUNT_NAV;

const ITEMS: readonly AccountNavItem[] = ACCOUNT_NAV.flatMap(
  (group): readonly AccountNavItem[] => group.items,
);

// The nav item a path belongs to: exact match for the profile root, prefix match below it.
export function activeAccountItem(pathname: string): AccountNavItem {
  return (
    ITEMS.filter(
      (item) =>
        pathname === item.href ||
        (item.href !== AUTH_ROUTES.account &&
          pathname.startsWith(`${item.href}/`)),
    ).at(0) ?? PROFILE
  );
}
