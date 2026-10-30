"use client";

import Link from "next/link";
import { useRef } from "react";
import { TOTP_CODE_LENGTH } from "@/components/auth/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Shield02Icon,
  type Shield02IconHandle,
} from "@/components/ui/shield-02";
import { authClient } from "@/lib/auth-client";
import { AUTH_ROUTES } from "@/lib/auth-routes";
import { PasswordConfirmDialog } from "./PasswordConfirmDialog";

export function TwoFactorPanel({ enabled }: { enabled: boolean }) {
  const shield = useRef<Shield02IconHandle>(null);
  return (
    <Card onMouseEnter={() => shield.current?.startAnimation()}>
      <CardHeader>
        <CardTitle>
          <h2 className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"
            >
              <Shield02Icon ref={shield} size={20} />
            </span>
            Two-factor sign-in
            <Badge variant={enabled ? "default" : "outline"}>
              {enabled ? "On" : "Off"}
            </Badge>
          </h2>
        </CardTitle>
        <CardDescription>
          {enabled
            ? `On. Signing in asks for a ${TOTP_CODE_LENGTH}-digit code from your authenticator app.`
            : "Off. Add a code from an authenticator app so a stolen password isn't enough."}
        </CardDescription>
        <CardAction>
          {enabled ? (
            <PasswordConfirmDialog
              trigger={
                <Button variant="outline" className="pointer-coarse:min-h-11">
                  Turn off two-factor
                </Button>
              }
              title="Turn off two-factor sign-in?"
              description="Your account will be protected by your password alone."
              confirmLabel="Turn off"
              destructive
              onConfirm={async (password) => {
                const { error } = await authClient.twoFactor.disable({
                  password,
                });
                return { error, message: "Two-factor sign-in is off." };
              }}
            />
          ) : (
            <Button asChild className="pointer-coarse:min-h-11">
              <Link href={AUTH_ROUTES.twoFactorSetup}>Set up two-factor</Link>
            </Button>
          )}
        </CardAction>
      </CardHeader>
    </Card>
  );
}
