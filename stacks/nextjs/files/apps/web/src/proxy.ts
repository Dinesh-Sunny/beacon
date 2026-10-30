import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Optimistic gate: no session cookie, straight to sign-in. It never trusts the cookie; pages and
// actions still validate the session (requireSession). Kept this small on purpose: Better Auth's
// nextCookies misbehaves with heavier proxies (better-auth#9776).
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/account/:path*"],
};
