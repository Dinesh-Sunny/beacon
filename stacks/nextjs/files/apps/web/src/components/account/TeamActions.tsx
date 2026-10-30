"use client";

import { type OrgRole, OWNER_ROLE } from "@__NAME__/auth/access";
import {
  Delete02Icon,
  MoreHorizontalIcon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { announce, focusPageHeading } from "@/lib/announce";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { ALL_ROLES, INVITABLE_ROLES, ROLE_LABELS } from "@/lib/org-roles";
import { submitKeepingValues } from "@/lib/submit-keeping-values";
import { MutationMessage } from "./MutationMessage";
import { type MutationState, useAuthMutation } from "./use-auth-mutation";

const DEFAULT_INVITE_ROLE: OrgRole = "member";

export function InviteMemberDialog({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setAttempt((count) => count + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button className="pointer-coarse:min-h-11">
          <HugeiconsIcon
            icon={UserAdd01Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Invite someone
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <InviteMemberForm
          key={attempt}
          organizationId={organizationId}
          organizationName={organizationName}
        />
      </DialogContent>
    </Dialog>
  );
}

function InviteMemberForm({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const [state, invite, pending] = useAuthMutation(async (form) => {
    const email = String(form.get("email") ?? "").trim();
    const { error } = await authClient.organization.inviteMember({
      organizationId,
      email,
      role: String(form.get("role")) as OrgRole,
    });
    return { error, message: `Invitation sent to ${email}.` };
  });
  return (
    <form
      onSubmit={submitKeepingValues(invite)}
      className="flex flex-col gap-6"
    >
      <DialogHeader>
        <DialogTitle>Invite someone to {organizationName}</DialogTitle>
        <DialogDescription>
          They get an email with a link to join. It works for the address you
          enter only.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="sm:flex-row">
        <Field className="flex-1">
          <FieldLabel htmlFor="invite-email">Email</FieldLabel>
          <Input
            id="invite-email"
            name="email"
            type="email"
            autoComplete="off"
            required
          />
        </Field>
        <Field className="sm:w-32">
          <FieldLabel htmlFor="invite-role">Role</FieldLabel>
          <Select name="role" defaultValue={DEFAULT_INVITE_ROLE}>
            <SelectTrigger id="invite-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectGroup>
                {INVITABLE_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
      <MutationMessage state={state} />
      <DialogFooter>
        <Button
          type="submit"
          disabled={pending}
          className="pointer-coarse:min-h-11"
        >
          {pending && <Spinner className="motion-reduce:animate-none" />}
          Send invitation
        </Button>
      </DialogFooter>
    </form>
  );
}

// Row menu for a member: change role (a menu choice is an explicit action, unlike a select
// that changes on arrow keys) and remove, which confirms first. Only owners may grant or touch
// the owner role, so admins see neither (the server would refuse them anyway).
export function MemberActions({
  memberId,
  organizationId,
  role,
  name,
  viewerIsOwner,
}: {
  memberId: string;
  organizationId: string;
  role: OrgRole;
  name: string;
  viewerIsOwner: boolean;
}) {
  const router = useRouter();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const removed = useRef(false);
  const [changing, startTransition] = useTransition();
  const [roleResult, setRoleResult] = useState<MutationState>({
    status: "idle",
  });
  const roles = viewerIsOwner
    ? ALL_ROLES
    : ALL_ROLES.filter((option) => option !== OWNER_ROLE);

  function changeRole(next: OrgRole) {
    if (next === role) return;
    startTransition(async () => {
      const { error } = await authClient.organization.updateMemberRole({
        memberId,
        organizationId,
        role: next,
      });
      setRoleResult(
        error
          ? { status: "error", message: authErrorMessage(error) }
          : {
              status: "done",
              message: `${name} is now ${ROLE_LABELS[next].toLowerCase()}.`,
            },
      );
      if (!error) router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {changing && <Spinner className="motion-reduce:animate-none" />}
      <DropdownMenu
        // A new attempt starts clean: the last role error goes when the menu opens again.
        onOpenChange={(open) => open && setRoleResult({ status: "idle" })}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${name}`}
            className="pointer-coarse:size-11"
          >
            <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Role
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={role}
            onValueChange={(next) => changeRole(next as OrgRole)}
          >
            {roles.map((option) => (
              <DropdownMenuRadioItem key={option} value={option}>
                {ROLE_LABELS[option]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmRemove(true)}
          >
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
            Remove from team
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MutationMessage state={roleResult} />
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent
          // The member's row is about to disappear, so focus goes to the page heading instead.
          onCloseAutoFocus={(event) => {
            if (!removed.current) return;
            event.preventDefault();
            focusPageHeading();
          }}
        >
          {/* Content unmounts on close, so each opening starts without the last error. */}
          <RemoveMemberForm
            memberId={memberId}
            organizationId={organizationId}
            name={name}
            onRemoved={() => {
              removed.current = true;
              setConfirmRemove(false);
            }}
          />
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RemoveMemberForm({
  memberId,
  organizationId,
  name,
  onRemoved,
}: {
  memberId: string;
  organizationId: string;
  name: string;
  onRemoved: () => void;
}) {
  const [state, remove, removing] = useAuthMutation(async () => {
    const { error } = await authClient.organization.removeMember({
      memberIdOrEmail: memberId,
      organizationId,
    });
    if (!error) {
      announce(`${name} removed.`);
      onRemoved();
    }
    return { error, message: `${name} removed.` };
  });
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
        <AlertDialogDescription>
          They lose access to this organization and its API keys right away. You
          can invite them again later.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <MutationMessage state={state} />
      <AlertDialogFooter>
        <AlertDialogCancel className="pointer-coarse:min-h-11">
          Keep {name}
        </AlertDialogCancel>
        {/* A plain submit (not AlertDialogAction) so the dialog stays open until the request ends. */}
        <form action={remove}>
          <Button
            type="submit"
            variant="destructive"
            disabled={removing}
            className="w-full pointer-coarse:min-h-11"
          >
            {removing && <Spinner className="motion-reduce:animate-none" />}
            Remove
          </Button>
        </form>
      </AlertDialogFooter>
    </>
  );
}

export function CancelInvitationButton({
  invitationId,
  email,
}: {
  invitationId: string;
  email: string;
}) {
  const [state, cancel, pending] = useAuthMutation(async () => {
    const { error } = await authClient.organization.cancelInvitation({
      invitationId,
    });
    if (!error) {
      // The row goes on refresh; keep focus and the confirmation on the page.
      announce(`Invitation to ${email} cancelled.`);
      focusPageHeading();
    }
    return { error, message: `Invitation to ${email} cancelled.` };
  });
  return (
    <form action={cancel} className="flex flex-col items-end gap-1">
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        className="pointer-coarse:min-h-11"
      >
        {pending && <Spinner className="motion-reduce:animate-none" />}
        Cancel<span className="sr-only"> invitation to {email}</span>
      </Button>
      {state.status === "error" && <MutationMessage state={state} />}
    </form>
  );
}
