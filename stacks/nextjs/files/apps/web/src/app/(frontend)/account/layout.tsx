import { type ReactNode, Suspense } from "react";
import { AccountSidebar } from "@/components/account/AccountSidebar";
import { AccountTopbar } from "@/components/account/AccountTopbar";
import { ConsentIdentity } from "@/components/consent/ConsentIdentity";
import { AnalyticsIdentity } from "@/components/observability/AnalyticsIdentity";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { loadAccountContext } from "@/lib/account";
import { ANNOUNCER_ID } from "@/lib/announce";

async function AccountShell({ children }: { children: ReactNode }) {
  // Signed out: render the page alone; its getAccountContext() redirects to sign-in with the
  // page's own path as `next`, which the layout can't know.
  const context = await loadAccountContext();
  if (!context) return children;
  return (
    <SidebarProvider>
      <AnalyticsIdentity userId={context.user.id} />
      <ConsentIdentity />
      <AccountSidebar
        context={{
          user: { name: context.user.name, email: context.user.email },
          organizations: context.organizations,
          activeOrganization: context.activeOrganization,
        }}
      />
      <SidebarInset>
        <AccountTopbar />
        <p id={ANNOUNCER_ID} aria-live="polite" className="sr-only" />
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 md:px-8 md:py-10">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AccountShellSkeleton() {
  return (
    <output aria-busy="true" className="flex min-h-svh w-full">
      <span className="sr-only">Loading your account</span>
      <div className="hidden w-64 flex-col gap-4 border-r bg-sidebar p-4 md:flex">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="flex flex-1 flex-col gap-6 p-8">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-72" />
        <Skeleton className="h-48 w-full max-w-4xl" />
      </div>
    </output>
  );
}

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <Suspense fallback={<AccountShellSkeleton />}>
      <AccountShell>{children}</AccountShell>
    </Suspense>
  );
}
