import { type OrgRole, OWNER_ROLE } from "@__NAME__/auth/access";
import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { AccountPageSkeleton } from "@/components/account/AccountPageSkeleton";
import { CreateOrganizationButton } from "@/components/account/CreateOrganizationButton";
import {
  CancelInvitationButton,
  InviteMemberDialog,
  MemberActions,
} from "@/components/account/TeamActions";
import { UserAvatar } from "@/components/account/UserAvatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
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
import { getAccountContext, loadTeam } from "@/lib/account";
import { AUTH_ROUTES } from "@/lib/auth-routes";
import { formatDateTime } from "@/lib/format";
import { pageMetadata } from "@/lib/metadata";
import { hasRole, roleLabel } from "@/lib/org-roles";

export const metadata: Metadata = pageMetadata({
  title: "Team",
  path: AUTH_ROUTES.accountTeam,
  noIndex: true,
});

async function Team() {
  const { user, activeOrganization } = await getAccountContext(
    AUTH_ROUTES.accountTeam,
  );
  const team = await loadTeam(AUTH_ROUTES.accountTeam);

  if (!team) {
    return (
      <>
        <AccountPageHeader
          title="Team"
          description="Organizations hold your team, its roles, and its API keys."
        />
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>Create your first organization</EmptyTitle>
            <EmptyDescription>
              You become its owner and can invite people with owner, admin, or
              member roles.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <CreateOrganizationButton />
          </EmptyContent>
        </Empty>
      </>
    );
  }

  const { organization: org, canManageMembers, pendingInvitations } = team;
  const memberCount = org.members.length;
  const viewerIsOwner = hasRole(activeOrganization?.role, OWNER_ROLE);

  return (
    <>
      <AccountPageHeader
        title="Team"
        description={`People in ${org.name} and what they can do.`}
        action={
          canManageMembers && (
            <InviteMemberDialog
              organizationId={org.id}
              organizationName={org.name}
            />
          )
        }
      />
      <Card className="pb-0">
        <CardHeader>
          <CardTitle>
            <h2>Members</h2>
          </CardTitle>
          <CardDescription>
            {memberCount} {memberCount === 1 ? "person" : "people"}.{" "}
            {canManageMembers
              ? "Owners and admins can change roles and remove people."
              : "Owners and admins manage roles."}
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Name</TableHead>
              <TableHead className="hidden sm:table-cell">Role</TableHead>
              {canManageMembers && (
                <TableHead className="pr-6 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {org.members.map((member) => {
              const isYou = member.userId === user.id;
              // Admins can't change or remove owners; only owners can.
              const canAct =
                !isYou && (viewerIsOwner || !hasRole(member.role, OWNER_ROLE));
              return (
                <TableRow key={member.id}>
                  <TableCell className="max-w-0 pl-6">
                    <span className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={member.user.name} />
                      <span className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-2 truncate font-medium">
                          {member.user.name}
                          {isYou && <Badge variant="secondary">You</Badge>}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {member.user.email}
                        </span>
                        <span className="pt-1 sm:hidden">
                          <Badge variant="outline">
                            {roleLabel(member.role)}
                          </Badge>
                        </span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline">{roleLabel(member.role)}</Badge>
                  </TableCell>
                  {canManageMembers && (
                    <TableCell className="pr-6 text-right">
                      {canAct && (
                        <MemberActions
                          memberId={member.id}
                          organizationId={org.id}
                          role={member.role as OrgRole}
                          name={member.user.name}
                          viewerIsOwner={viewerIsOwner}
                        />
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {canManageMembers && pendingInvitations.length > 0 && (
        <Card className="pb-0">
          <CardHeader>
            <CardTitle>
              <h2>Pending invitations</h2>
            </CardTitle>
            <CardDescription>
              Each link works once, for the address it was sent to. Times are
              UTC.
            </CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden sm:table-cell">Expires</TableHead>
                <TableHead className="pr-6 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingInvitations.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="max-w-48 truncate pl-6 font-medium">
                    {invite.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{roleLabel(invite.role)}</Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                    {formatDateTime(invite.expiresAt)}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <CancelInvitationButton
                      invitationId={invite.id}
                      email={invite.email}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={<AccountPageSkeleton />}>
      <Team />
    </Suspense>
  );
}
