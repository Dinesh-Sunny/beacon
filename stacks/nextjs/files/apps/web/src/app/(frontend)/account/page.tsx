import {
  ArrowRight01Icon,
  ComputerIcon,
  SecurityLockIcon,
  SquareLockPasswordIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { AccountPageSkeleton } from "@/components/account/AccountPageSkeleton";
import { ProfileForm } from "@/components/account/ProfileForm";
import { UserAvatar } from "@/components/account/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { getAccountContext, loadSessions } from "@/lib/account";
import { AUTH_ROUTES } from "@/lib/auth-routes";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Your profile",
  path: AUTH_ROUTES.account,
  noIndex: true,
});

async function Profile() {
  // Session first: signed out redirects before anything else asks the API.
  const { user, activeOrganization } = await getAccountContext(
    AUTH_ROUTES.account,
  );
  const sessions = await loadSessions();
  const devices = sessions.length;

  return (
    <>
      <AccountPageHeader
        title="Profile"
        description="How you appear to your team, and a summary of your sign-in security."
      />
      <Card>
        <CardContent className="flex-row flex-wrap items-center gap-4">
          <UserAvatar
            name={user.name}
            className="size-16"
            fallbackClassName="text-xl"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="font-heading text-xl break-words">{user.name}</p>
            <p className="break-all text-muted-foreground">{user.email}</p>
            <p className="flex flex-wrap gap-2 pt-1">
              <Badge variant={user.emailVerified ? "secondary" : "destructive"}>
                {user.emailVerified ? "Email verified" : "Email not verified"}
              </Badge>
              {activeOrganization && (
                <Badge variant="outline">{activeOrganization.name}</Badge>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      <ProfileForm name={user.name} />

      <section
        aria-labelledby="security-summary"
        className="flex flex-col gap-3"
      >
        <h2 id="security-summary" className="font-heading text-lg">
          Sign-in security
        </h2>
        <Card className="py-2">
          <ItemGroup className="gap-0">
            <SummaryItem
              icon={SecurityLockIcon}
              title="Two-factor sign-in"
              description={
                user.twoFactorEnabled
                  ? "On. A code from your app is needed to sign in."
                  : "Off. Turn it on so a stolen password isn't enough."
              }
              badge={user.twoFactorEnabled ? "On" : "Off"}
              highlight={!user.twoFactorEnabled}
            />
            <ItemSeparator className="my-1" />
            <SummaryItem
              icon={ComputerIcon}
              title="Devices"
              description={`Signed in on ${devices} ${devices === 1 ? "device" : "devices"}.`}
            />
            <ItemSeparator className="my-1" />
            <SummaryItem
              icon={SquareLockPasswordIcon}
              title="Password"
              description="Change it, or sign out everywhere else."
            />
          </ItemGroup>
        </Card>
      </section>
    </>
  );
}

function SummaryItem({
  icon,
  title,
  description,
  badge,
  highlight = false,
}: {
  icon: typeof SecurityLockIcon;
  title: string;
  description: string;
  badge?: string;
  highlight?: boolean;
}) {
  return (
    <Item asChild size="sm" className="mx-2 w-auto">
      <Link href={AUTH_ROUTES.accountSecurity}>
        <ItemMedia variant="icon">
          <HugeiconsIcon icon={icon} strokeWidth={2} />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{title}</ItemTitle>
          <ItemDescription>{description}</ItemDescription>
        </ItemContent>
        <ItemActions>
          {badge && (
            <Badge variant={highlight ? "outline" : "secondary"}>{badge}</Badge>
          )}
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            strokeWidth={2}
            className="size-4 text-muted-foreground"
          />
        </ItemActions>
      </Link>
    </Item>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<AccountPageSkeleton />}>
      <Profile />
    </Suspense>
  );
}
