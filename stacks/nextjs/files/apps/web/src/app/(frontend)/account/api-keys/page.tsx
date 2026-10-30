import { Key01Icon, LockPasswordIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Metadata } from "next";
import { type ReactNode, Suspense } from "react";
import { AccountPageHeader } from "@/components/account/AccountPageHeader";
import { AccountPageSkeleton } from "@/components/account/AccountPageSkeleton";
import {
  CreateApiKeyDialog,
  DeleteApiKeyButton,
} from "@/components/account/ApiKeyForms";
import { CreateOrganizationButton } from "@/components/account/CreateOrganizationButton";
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
import { loadApiKeys } from "@/lib/account";
import { AUTH_ROUTES } from "@/lib/auth-routes";
import { formatDateTime } from "@/lib/format";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "API keys",
  path: AUTH_ROUTES.accountApiKeys,
  noIndex: true,
});

function KeysEmpty({
  title,
  description,
  action,
  icon = Key01Icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: typeof Key01Icon;
}) {
  return (
    <Empty className="border">
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

async function ApiKeys() {
  const keys = await loadApiKeys(AUTH_ROUTES.accountApiKeys);
  const header = (action?: ReactNode) => (
    <AccountPageHeader
      title="API keys"
      description={
        keys
          ? `Keys let servers and scripts act for ${keys.organization.name}.`
          : "Keys let servers and scripts act for an organization."
      }
      action={action}
    />
  );

  if (!keys) {
    return (
      <>
        {header()}
        <KeysEmpty
          title="Keys belong to an organization"
          description="Create one first, then make keys for it here."
          action={<CreateOrganizationButton />}
        />
      </>
    );
  }

  if (!keys.canReadKeys) {
    return (
      <>
        {header()}
        <KeysEmpty
          icon={LockPasswordIcon}
          title="Owners and admins manage keys"
          description={`Ask an owner or admin of ${keys.organization.name} if you need one.`}
        />
      </>
    );
  }

  const create = keys.canManageKeys && (
    <CreateApiKeyDialog
      organizationId={keys.organization.id}
      organizationName={keys.organization.name}
    />
  );

  // The create dialog always lives in the header: the first key flips the page from empty to
  // list, and a dialog inside the empty state would unmount and lose the key it is showing.
  if (keys.apiKeys.length === 0) {
    return (
      <>
        {header(create)}
        <KeysEmpty
          title="No keys yet"
          description="Each key is shown once when you create it. Store it in your secrets manager."
        />
      </>
    );
  }

  return (
    <>
      {header(create)}
      <Card className="pb-0">
        <CardHeader>
          <CardTitle>
            <h2>Active keys</h2>
          </CardTitle>
          <CardDescription>
            {keys.apiKeys.length} {keys.apiKeys.length === 1 ? "key" : "keys"}.
            Only the first characters are stored for display. Times are UTC.
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead className="hidden sm:table-cell">Created</TableHead>
              {keys.canManageKeys && (
                <TableHead className="pr-6 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.apiKeys.map((key) => (
              <TableRow key={key.id}>
                <TableCell className="pl-6 font-medium">
                  {key.name ?? "Unnamed key"}
                </TableCell>
                <TableCell>
                  <code className="font-mono text-xs text-muted-foreground">
                    {key.start ?? key.prefix}••••••••
                  </code>
                </TableCell>
                <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                  {formatDateTime(key.createdAt)}
                </TableCell>
                {keys.canManageKeys && (
                  <TableCell className="pr-6 text-right">
                    <DeleteApiKeyButton
                      keyId={key.id}
                      name={key.name ?? "this key"}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

export default function ApiKeysPage() {
  return (
    <Suspense fallback={<AccountPageSkeleton />}>
      <ApiKeys />
    </Suspense>
  );
}
