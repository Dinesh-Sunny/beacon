"use client";

import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { resetIdentity } from "@/lib/observability/analytics";
import { PasswordConfirmDialog } from "./PasswordConfirmDialog";

export function DeleteAccountPanel() {
  const router = useRouter();
  return (
    <Card className="ring-destructive/30">
      <CardHeader>
        <CardTitle>
          <h2 className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
            >
              <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
            </span>
            Delete account
          </h2>
        </CardTitle>
        <CardDescription>
          Removes your profile, sessions, memberships, cookie choices, and
          analytics data for good.
        </CardDescription>
        <CardAction>
          <PasswordConfirmDialog
            trigger={
              <Button variant="destructive" className="pointer-coarse:min-h-11">
                Delete account
              </Button>
            }
            title="Delete your account?"
            description="This removes your profile, sessions, and memberships. It can't be undone."
            confirmLabel="Delete account"
            destructive
            onConfirm={async (password) => {
              const { error } = await authClient.deleteUser({ password });
              if (!error) {
                resetIdentity();
                router.push("/");
              }
              return { error };
            }}
          />
        </CardAction>
      </CardHeader>
    </Card>
  );
}
