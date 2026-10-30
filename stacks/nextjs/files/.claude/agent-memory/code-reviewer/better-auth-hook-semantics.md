---
name: better-auth-hook-semantics
description: Verified Better Auth 1.7.7 hook behavior (db hooks, endpoint context, 2FA sessions) that audit/event code in packages/auth keeps tripping over
metadata:
  type: project
---

Verified in node_modules (better-auth/dist/db/with-hooks.mjs, api/dispatch.mjs) on 2026-10-03 for 1.7.7. Re-check if the version moves.

- db `before`/`after` hooks get the SAME endpoint-context object (captured once per call), so WeakMap keyed by it works; `after` hooks are queued until the transaction commits (queueAfterTransactionHook).
- `updateManyWithHooks` passes the affected-row COUNT (a number) to `update.after`, not a row. `internalAdapter.updatePassword` (password reset) goes through it, so `account.userId` is undefined there. `updateAccount` (change/set password) passes the row.
- `hooks.before/after` middleware get a fresh spread `ctx` per hook; `ctx.request` and `ctx.headers` (one `new Headers()` per dispatch) are stable between before and after, `ctx` itself is not.
- Two-factor sign-in: the password step creates a session then deletes it (session.create.after + delete.after fire); enabling/disabling 2FA also rotates the session. Don't treat session.create.after as "signed in".

**Why:** each of these produced a wrong-actor or wrong-event bug in review of feat/compliance.
**How to apply:** when reviewing any Better Auth hook that emits events or audit rows, check these four first.
