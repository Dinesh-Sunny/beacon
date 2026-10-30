import { ComputerIcon, SmartPhone01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { AccountPageSkeleton } from "@/components/account/AccountPageSkeleton";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { DataExportPanel } from "@/components/account/DataExportPanel";
import { DeleteAccountPanel } from "@/components/account/DeleteAccountPanel";
import { SignOutOthersButton } from "@/components/account/SignOutOthersButton";
import { TwoFactorPanel } from "@/components/account/TwoFactorPanel";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAccountContext, loadSessions } from "@/lib/account";
import { AUTH_ROUTES } from "@/lib/auth-routes";
import { formatDateTime } from "@/lib/format";
import { pageMetadata } from "@/lib/metadata";
import { deviceLabel, isMobileDevice } from "@/lib/user-agent";

export const metadata: Metadata = pageMetadata({
  title: "Security",
  path: AUTH_ROUTES.accountSecurity,
  noIndex: true,
});

async function Security() {
  // Session first: signed out redirects before anything else asks the API.
  const { user, currentSessionId } = await getAccountContext(
    AUTH_ROUTES.accountSecurity,
  );
  const sessions = await loadSessions();
  const others = sessions.length - 1;

  return (
    <>
      <AccountPageHeader
        title="Security"
        description="Your password, two-factor sign-in, the devices signed in to your account, and your data."
      />
      <TwoFactorPanel enabled={Boolean(user.twoFactorEnabled)} />
      <ChangePasswordForm />
      <Card className="pb-0">
        <CardHeader>
          <CardTitle>
            <h2>Devices</h2>
          </CardTitle>
          <CardDescription>
            Signed in on {sessions.length}{" "}
            {sessions.length === 1 ? "device" : "devices"}. Times are UTC.
          </CardDescription>
          <CardAction>
            <SignOutOthersButton disabled={others === 0} />
          </CardAction>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Device</TableHead>
              <TableHead className="hidden pr-6 text-right sm:table-cell">
                Last active
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell className="pl-6">
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                    >
                      <HugeiconsIcon
                        icon={
                          isMobileDevice(session.device)
                            ? SmartPhone01Icon
                            : ComputerIcon
                        }
                        strokeWidth={2}
                        className="size-4"
                      />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">
                        {deviceLabel(session.device)}
                      </span>
                      <span className="text-xs text-muted-foreground sm:hidden">
                        {formatDateTime(session.lastActive)}
                      </span>
                    </span>
                    {session.id === currentSessionId && (
                      <Badge variant="secondary">This device</Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="hidden pr-6 text-right text-muted-foreground tabular-nums sm:table-cell">
                  <time dateTime={new Date(session.lastActive).toISOString()}>
                    {formatDateTime(session.lastActive)}
                  </time>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <DataExportPanel />
      <DeleteAccountPanel />
    </>
  );
}

export default function SecurityPage() {
  return (
    <Suspense fallback={<AccountPageSkeleton />}>
      <Security />
    </Suspense>
  );
}
