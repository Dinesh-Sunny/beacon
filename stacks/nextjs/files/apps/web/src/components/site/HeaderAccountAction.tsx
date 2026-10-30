import Link from "next/link";
import { Button } from "@/components/ui/button";
import { authUrl, isAuthHost } from "@/lib/auth-host";
import { AUTH_ROUTES } from "@/lib/auth-routes";
import { getSession } from "@/lib/session";
import type { SiteContext } from "@/lib/tenant";

const BUTTON = {
  variant: "outline",
  size: "sm",
  className: "pointer-coarse:min-h-11",
} as const;

// Account for signed-in visitors, Sign in for everyone else. On a tenant's own domain there's no
// session (it lives on the app host), so the link goes to the app host's sign-in.
export async function HeaderAccountAction({ site }: { site: SiteContext }) {
  if (!isAuthHost(site.host)) {
    return (
      <Button asChild {...BUTTON}>
        <a href={authUrl(AUTH_ROUTES.signIn)}>Sign in</a>
      </Button>
    );
  }
  const session = await getSession();
  return (
    <Button asChild {...BUTTON}>
      {session ? (
        <Link href={AUTH_ROUTES.account}>Account</Link>
      ) : (
        <Link href={AUTH_ROUTES.signIn}>Sign in</Link>
      )}
    </Button>
  );
}
