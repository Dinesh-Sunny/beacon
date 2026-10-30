---
name: better-auth-review-checks
description: Better Auth review checks for this repo (allowedHosts wildcards become redirect allowlist, request-derived JWT iss, plugin action names, floating email promises); verify in node_modules dist
metadata:
  type: project
---

First seen reviewing feat/auth (2026-10-02, better-auth 1.7.7).

- `baseURL.allowedHosts` entries are copied into trustedOrigins (context/helpers.mjs). `*.vercel.app` trusts every Vercel tenant for callbackURL/redirectTo, so reset tokens can leak. Prove it with `matchesOriginPattern` from dist/auth/trusted-origins.mjs.
- With a dynamic baseURL, JWT `iss`/`aud` default to the request origin (plugins/jwt/sign.mjs), not BETTER_AUTH_URL. Tests that use a string baseURL hide this.
- Plugin permission checks use their own action names. For example, api-key checks apiKey create/read/update/delete. Custom `ac` statements must use the same words.
- Better Auth already wraps sends in runInBackgroundOrAwait. Floating promises in callbacks skip `advanced.backgroundTasks.handler`.
- admin `/admin/remove-user` skips `user.deleteUser.afterDelete`. Put lifecycle events in databaseHooks.
- PyJWKClientConnectionError subclasses PyJWTError, so catch-all handlers turn a JWKS outage into a 401.

- magicLink `/magic-link/verify` sets a session directly. twoFactor's after-hook only matches /sign-in/email|username|phone-number, so magic link skips 2FA (seen feat/auth-ui).
- api-key `listApiKeys({organizationId})` throws FORBIDDEN without `apiKey:read`. Default `member` role lacks it, so server loaders crash for members. Gate on hasPermission.
- Hand-rolled `next`/redirect validators miss `/\t/evil.com` (URL parser strips tab/CR/LF). Compare with `isSafeRelativeURL` in dist/auth/trusted-origins.mjs.
- requireEmailVerification makes sign-up return a generic success for existing emails and send nothing unless `onExistingUserSignUp` is set. "We sent a link" copy is then false.

**Why:** all of these passed `pnpm check` plus local e2e. They only fail on previews, in prod, or under attack.
**How to apply:** for auth changes, grep the installed dist instead of trusting the docs. See also [[db-review-checks]].

- `deleteUser` cascades member rows but leaves orgs whose only owner was deleted. Their org-owned API keys (referenceId = org id) stay valid and nobody can revoke them. Fix it with `user.deleteUser.beforeDelete` (update-user.mjs:325). Seen feat/auth-ui.
- updateMemberRole denies admins who change an owner or grant owner (crud-members.mjs:292). If the UI offers those actions anyway, it fails with a raw server message.
- With `advanced.backgroundTasks.handler` set, runInBackgroundOrAwait wraps sends in `.catch(logger.error)` (context/create-context.mjs:218). Sign-up, verify, reset, invite, and account-exists send failures only show in logs. sendMagicLink is awaited inline, so it 500s. Seen feat/email.
