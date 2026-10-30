import assert from "node:assert/strict";
import { createPublicKey, randomUUID, verify } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { closeDb, getDb } from "@__NAME__/db";
import { type Auth, createAuth } from "./auth.ts";
import {
  authorizeOrganizationBilling,
  getOrganizationPlan,
} from "./billing.ts";
import {
  AUTH_EMAIL_LINK_LIFETIME_SECONDS,
  BOT_DETECTED_ERROR_CODE,
  FREE_LIMITS,
  FREE_PLAN,
  PLANS,
  SEAT_LIMIT_ERROR_CODE,
  SERVICE_TOKEN_AUDIENCE,
  SOLE_OWNER_ERROR_CODE,
} from "./config.ts";
import type { AuthEmail } from "./email.ts";
import type { AuthEvent } from "./events.ts";
import type { AuthJob } from "./jobs.ts";
import { deleteExpiredAuthRecords } from "./maintenance.ts";
import { resolveAuthOrigins } from "./origins.ts";

// Integration tests: need a migrated Postgres (`pnpm db:up && pnpm db:migrate`). CI provides one.
const skip = process.env.DATABASE_URL
  ? false
  : "DATABASE_URL not set (run `pnpm db:up`)";

const BASE_URL = "http://localhost:3000";
const RUN_ID = randomUUID().slice(0, 8);
const EMAIL_DOMAIN = `auth-test-${RUN_ID}.test`;
const PASSWORD = "correct horse battery staple 42";
const FALLBACK_TEST_SECRET = "local-test-secret-at-least-32-characters-long";

function testEmail(name: string): string {
  return `${name}@${EMAIL_DOMAIN}`;
}

function cookieHeader(headers: Headers): Headers {
  const cookies = headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
  return new Headers({ cookie: cookies });
}

describe("auth", { skip }, () => {
  const outbox: AuthEmail[] = [];
  const events: AuthEvent[] = [];
  let auth: Auth;

  before(() => {
    auth = createAuth({
      appName: "__NAME__-test",
      // Same secret as the app: JWT signing keys in the database are encrypted with it, so a
      // different secret per run couldn't read keys another run (or the dev server) created.
      secret: process.env.BETTER_AUTH_SECRET ?? FALLBACK_TEST_SECRET,
      origins: resolveAuthOrigins({
        NODE_ENV: "test",
        BETTER_AUTH_URL: BASE_URL,
      }),
      sendEmail: async (email) => {
        outbox.push(email);
      },
      onEvent: (event) => {
        events.push(event);
      },
    });
  });

  after(async () => {
    const client = getDb().$client;
    // Org keys and subscriptions have no foreign key to their org, so remove them explicitly.
    for (const table of ["apikey", "subscription"]) {
      await client.query(
        `delete from auth.${table} where reference_id in
           (select id::text from auth.organization where slug like $1)`,
        [`%-${RUN_ID}`],
      );
    }
    await client.query("delete from auth.organization where slug like $1", [
      `%-${RUN_ID}`,
    ]);
    // Cascades to sessions, accounts, and memberships.
    await client.query(`delete from auth."user" where email like $1`, [
      `%@${EMAIL_DOMAIN}`,
    ]);
    await closeDb();
  });

  function lastEmail(kind: AuthEmail["kind"], to: string): AuthEmail {
    const found = outbox.findLast(
      (sent) => sent.kind === kind && sent.to === to,
    );
    assert.ok(found, `expected a ${kind} email to ${to}`);
    return found;
  }

  async function signUpVerifiedUser(
    name: string,
  ): Promise<{ headers: Headers; userId: string }> {
    const email = testEmail(name);
    const { user } = await auth.api.signUpEmail({
      body: { name, email, password: PASSWORD },
    });
    const token = new URL(
      lastEmail("verify-email", email).url,
    ).searchParams.get("token");
    assert.ok(token, "verification link carries a token");
    await auth.api.verifyEmail({ query: { token } });
    const signIn = await auth.api.signInEmail({
      body: { email, password: PASSWORD },
      returnHeaders: true,
    });
    return { headers: cookieHeader(signIn.headers), userId: user.id };
  }

  async function createOrg(headers: Headers, name: string): Promise<string> {
    const org = await auth.api.createOrganization({
      headers,
      body: { name: `${name} ${RUN_ID}`, slug: `${name}-${RUN_ID}` },
    });
    assert.ok(org?.id);
    return org.id;
  }

  test("should leave the shop's payment-mode sessions to the shop webhook", async () => {
    const billingAuth = createAuth({
      appName: "__NAME__-test",
      secret: process.env.BETTER_AUTH_SECRET ?? FALLBACK_TEST_SECRET,
      origins: resolveAuthOrigins({
        NODE_ENV: "test",
        BETTER_AUTH_URL: BASE_URL,
      }),
      sendEmail: async (email) => {
        outbox.push(email);
      },
      stripe: { secretKey: "sk_test_unused", webhookSecret: "whsec_unused" },
    });
    const post = (mode: string) =>
      billingAuth.handler(
        new Request(`${BASE_URL}/api/auth/stripe/webhook`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "stripe-signature": "t=1,v1=x",
          },
          body: JSON.stringify({
            type: "checkout.session.completed",
            data: { object: { object: "checkout.session", mode } },
          }),
        }),
      );
    assert.equal((await post("payment")).status, 200);
    // Subscription sessions still go through the plugin, which checks the signature.
    assert.notEqual((await post("subscription")).status, 200);
  });

  test("should refuse checked auth requests from bots, over HTTP only", async () => {
    const botAuth = createAuth({
      appName: "__NAME__-test",
      secret: process.env.BETTER_AUTH_SECRET ?? FALLBACK_TEST_SECRET,
      origins: resolveAuthOrigins({
        NODE_ENV: "test",
        BETTER_AUTH_URL: BASE_URL,
      }),
      sendEmail: async (email) => {
        outbox.push(email);
      },
      isBot: async () => true,
    });
    const response = await botAuth.handler(
      new Request(`${BASE_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE_URL },
        body: JSON.stringify({
          name: "bot",
          email: testEmail("bot"),
          password: PASSWORD,
        }),
      }),
    );
    assert.equal(response.status, 403);
    assert.equal(
      ((await response.json()) as { code?: string }).code,
      BOT_DETECTED_ERROR_CODE,
    );
    // Server-side calls have no browser behind them and are never checked.
    const { user } = await botAuth.api.signUpEmail({
      body: {
        name: "server",
        email: testEmail("server-made"),
        password: PASSWORD,
      },
    });
    assert.ok(user.id);
  });

  test("should refuse sign-in when the email is not verified", async () => {
    const email = testEmail("unverified");
    await auth.api.signUpEmail({
      body: { name: "Unverified", email, password: PASSWORD },
    });
    await assert.rejects(
      auth.api.signInEmail({ body: { email, password: PASSWORD } }),
      /verif/i,
    );
  });

  test("should reject a password shorter than the policy minimum", async () => {
    await assert.rejects(
      auth.api.signUpEmail({
        body: {
          name: "Short",
          email: testEmail("short"),
          password: "too-short",
        },
      }),
      /password/i,
    );
  });

  test("should refuse a password reset that redirects to a foreign origin", async () => {
    const response = await auth.handler(
      new Request(`${BASE_URL}/api/auth/request-password-reset`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE_URL },
        body: JSON.stringify({
          email: testEmail("reset-target"),
          redirectTo: "https://attacker.vercel.app/steal",
        }),
      }),
    );
    assert.equal(response.status, 403);
  });

  test("should create a session and emit events when a verified user signs in", async () => {
    const { headers } = await signUpVerifiedUser("owner");
    const session = await auth.api.getSession({ headers });
    assert.equal(session?.user.email, testEmail("owner"));
    assert.ok(events.some((event) => event.type === "user.created"));
    assert.ok(events.some((event) => event.type === "session.created"));
    assert.ok(
      events.some(
        (event) =>
          event.type === "user.signed_in" &&
          event.userId === session?.user.id &&
          event.sessionId === session.session.id,
      ),
      "a finished sign-in is recorded with its session",
    );
  });

  test("should record a password reset for the person whose password changed", async () => {
    const { userId } = await signUpVerifiedUser("resetter");
    await auth.api.requestPasswordReset({
      body: { email: testEmail("resetter"), redirectTo: "/reset-password" },
    });
    const link = new URL(
      lastEmail("reset-password", testEmail("resetter")).url,
    );
    const token = link.pathname.split("/").at(-1);
    assert.ok(token);
    const since = events.length;
    await auth.api.resetPassword({
      body: { token, newPassword: `${PASSWORD} reset` },
    });
    const changed = events
      .slice(since)
      .filter((event) => event.type === "user.password_changed");
    assert.deepEqual(changed, [{ type: "user.password_changed", userId }]);
  });

  test("should grant the owner billing rights and send an invite when an org is created", async () => {
    const { headers } = await signUpVerifiedUser("org-owner");
    const organizationId = await createOrg(headers, "acme");

    const canManageBilling = await auth.api.hasPermission({
      headers,
      body: { organizationId, permissions: { billing: ["manage"] } },
    });
    assert.equal(canManageBilling.success, true);

    await auth.api.createInvitation({
      headers,
      body: { organizationId, email: testEmail("invitee"), role: "member" },
    });
    const invite = lastEmail("org-invitation", testEmail("invitee"));
    assert.ok(invite.url.startsWith(`${BASE_URL}/accept-invitation/`));
    assert.ok(invite.kind === "org-invitation");
    assert.equal(invite.invitation.role, "member");
    assert.equal(invite.invitation.organizationName, `acme ${RUN_ID}`);
    assert.ok(invite.invitation.inviterName);
  });

  test("should let an org admin delete a key and reject a tampered key", async () => {
    const owner = await signUpVerifiedUser("key-owner");
    const organizationId = await createOrg(owner.headers, "keys");
    const created = await auth.api.createApiKey({
      headers: owner.headers,
      body: { name: "ci", organizationId },
    });
    assert.match(created.key, /^agk_/);
    assert.equal(
      (await auth.api.verifyApiKey({ body: { key: created.key } })).valid,
      true,
    );
    assert.equal(
      (await auth.api.verifyApiKey({ body: { key: `${created.key}x` } })).valid,
      false,
    );

    const admin = await signUpVerifiedUser("key-admin");
    await auth.api.addMember({
      body: { userId: admin.userId, organizationId, role: "admin" },
    });
    await auth.api.deleteApiKey({
      headers: admin.headers,
      body: { keyId: created.id },
    });
    assert.equal(
      (await auth.api.verifyApiKey({ body: { key: created.key } })).valid,
      false,
    );
  });

  test("should stop accepting an org's keys when the org is deleted", async () => {
    const { headers } = await signUpVerifiedUser("gone-owner");
    const organizationId = await createOrg(headers, "gone");
    const created = await auth.api.createApiKey({
      headers,
      body: { name: "ci", organizationId },
    });

    await auth.api.deleteOrganization({ headers, body: { organizationId } });
    assert.equal(
      (await auth.api.verifyApiKey({ body: { key: created.key } })).valid,
      false,
    );
  });

  test("should emit audit events with the acting user for organization, key, and security changes", async () => {
    const owner = await signUpVerifiedUser("audit-owner");
    const teammate = await signUpVerifiedUser("audit-mate");
    const organizationId = await createOrg(owner.headers, "audit");
    const since = events.length;

    await auth.api.createInvitation({
      headers: owner.headers,
      body: {
        organizationId,
        email: testEmail("audit-invitee"),
        role: "member",
      },
    });
    const member = await auth.api.addMember({
      body: { userId: teammate.userId, organizationId, role: "member" },
    });
    assert.ok(member);
    await auth.api.updateMemberRole({
      headers: owner.headers,
      body: { organizationId, memberId: member.id, role: "admin" },
    });
    const key = await auth.api.createApiKey({
      headers: owner.headers,
      body: { name: "audit-key", organizationId },
    });
    await auth.api.deleteApiKey({
      headers: owner.headers,
      body: { keyId: key.id },
    });
    await auth.api.changePassword({
      headers: owner.headers,
      body: { currentPassword: PASSWORD, newPassword: `${PASSWORD}!` },
    });
    await getDb().$client.query(
      `update auth."user" set two_factor_enabled = true where id = $1`,
      [owner.userId],
    );
    await auth.api.disableTwoFactor({
      headers: owner.headers,
      body: { password: `${PASSWORD}!` },
    });

    const emitted = events.slice(since);
    const find = (type: AuthEvent["type"]) =>
      emitted.find((event) => event.type === type);
    assert.deepEqual(
      { ...find("invitation.created"), invitationId: undefined },
      {
        type: "invitation.created",
        actorId: owner.userId,
        organizationId,
        invitationId: undefined,
        role: "member",
      },
    );
    assert.deepEqual(find("member.added"), {
      type: "member.added",
      actorId: null,
      organizationId,
      memberUserId: teammate.userId,
      role: "member",
    });
    assert.deepEqual(find("member.role_changed"), {
      type: "member.role_changed",
      actorId: owner.userId,
      organizationId,
      memberUserId: teammate.userId,
      role: "admin",
      previousRole: "member",
    });
    assert.deepEqual(find("api_key.created"), {
      type: "api_key.created",
      actorId: owner.userId,
      organizationId,
      keyId: key.id,
      name: "audit-key",
    });
    assert.deepEqual(find("api_key.deleted"), {
      type: "api_key.deleted",
      actorId: owner.userId,
      organizationId,
      keyId: key.id,
      name: "audit-key",
    });
    assert.deepEqual(find("user.password_changed"), {
      type: "user.password_changed",
      userId: owner.userId,
    });
    assert.deepEqual(find("user.two_factor_changed"), {
      type: "user.two_factor_changed",
      userId: owner.userId,
      enabled: false,
    });
  });

  test("should emit user.deleted when an admin removes a user", async () => {
    const staff = await signUpVerifiedUser("support");
    await getDb().$client.query(
      `update auth."user" set role = 'admin' where id = $1`,
      [staff.userId],
    );
    const target = await signUpVerifiedUser("removed");

    await auth.api.removeUser({
      headers: staff.headers,
      body: { userId: target.userId },
    });
    assert.ok(
      events.some(
        (event) =>
          event.type === "user.deleted" && event.userId === target.userId,
      ),
    );
  });

  test("should issue a service token with a fixed audience that verifies against the JWKS", async () => {
    const { headers, userId } = await signUpVerifiedUser("service");
    const { token } = await auth.api.getToken({ headers });
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
    assert.ok(encodedHeader && encodedPayload && encodedSignature);

    const header = JSON.parse(
      Buffer.from(encodedHeader, "base64url").toString(),
    );
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString(),
    );
    assert.equal(header.alg, "EdDSA");
    assert.equal(payload.iss, BASE_URL);
    assert.equal(payload.aud, SERVICE_TOKEN_AUDIENCE);
    assert.equal(payload.sub, userId);
    assert.equal(payload.email, testEmail("service"));
    assert.equal(payload.impersonatedBy, null);

    const { keys } = await auth.api.getJwks();
    const jwk = keys.find((key) => key.kid === header.kid);
    assert.ok(jwk, "token key is published in the JWKS");
    const publicKey = createPublicKey({ key: jwk, format: "jwk" });
    const signed = Buffer.from(`${encodedHeader}.${encodedPayload}`);
    assert.equal(
      verify(
        null,
        signed,
        publicKey,
        Buffer.from(encodedSignature, "base64url"),
      ),
      true,
    );
  });

  test("should email the owner instead of a new link when someone signs up again", async () => {
    await signUpVerifiedUser("existing");
    await auth.api.signUpEmail({
      body: { name: "Again", email: testEmail("existing"), password: PASSWORD },
    });
    assert.ok(
      lastEmail("account-exists", testEmail("existing")).url.endsWith(
        "/sign-in",
      ),
    );
  });

  test("should not send or honour magic links for accounts with two-factor on", async () => {
    const { userId } = await signUpVerifiedUser("twofactor");
    const email = testEmail("twofactor");
    await auth.api.signInMagicLink({
      body: { email, callbackURL: "/account" },
      headers: new Headers(),
    });
    const issuedBefore = lastEmail("magic-link", email);
    const token = new URL(issuedBefore.url).searchParams.get("token");
    assert.ok(token);

    await getDb().$client.query(
      `update auth."user" set two_factor_enabled = true where id = $1`,
      [userId],
    );
    const sentBefore = outbox.length;
    await auth.api.signInMagicLink({
      body: { email, callbackURL: "/account" },
      headers: new Headers(),
    });
    assert.equal(
      outbox.length,
      sentBefore,
      "no new magic link for a two-factor account",
    );

    const { rows: before } = await getDb().$client.query(
      "select count(*)::int as n from auth.session where user_id = $1",
      [userId],
    );
    await auth.api
      .magicLinkVerify({
        query: { token, callbackURL: "/account" },
        headers: new Headers(),
      })
      .catch(() => undefined);
    const { rows: after } = await getDb().$client.query(
      "select count(*)::int as n from auth.session where user_id = $1",
      [userId],
    );
    assert.equal(
      after[0].n,
      before[0].n,
      "an older link must not create a session",
    );
  });

  test("should delete an org the user owns alone, keys included, when they delete their account", async () => {
    const { headers } = await signUpVerifiedUser("solo-leaver");
    const organizationId = await createOrg(headers, "solo");
    const created = await auth.api.createApiKey({
      headers,
      body: { name: "ci", organizationId },
    });

    await auth.api.deleteUser({ headers, body: { password: PASSWORD } });
    assert.equal(
      (await auth.api.verifyApiKey({ body: { key: created.key } })).valid,
      false,
    );
    const { rows } = await getDb().$client.query(
      "select 1 from auth.organization where id = $1",
      [organizationId],
    );
    assert.equal(rows.length, 0);
  });

  test("should refuse account deletion when the user is the only owner of a shared org", async () => {
    const owner = await signUpVerifiedUser("shared-owner");
    const organizationId = await createOrg(owner.headers, "shared");
    const teammate = await signUpVerifiedUser("shared-member");
    await auth.api.addMember({
      body: { userId: teammate.userId, organizationId, role: "member" },
    });

    await assert.rejects(
      auth.api.deleteUser({
        headers: owner.headers,
        body: { password: PASSWORD },
      }),
      (error: { body?: { code?: string } }) =>
        error.body?.code === SOLE_OWNER_ERROR_CODE,
    );
    const session = await auth.api.getSession({ headers: owner.headers });
    assert.ok(session, "the owner's account still exists");
  });

  async function subscribe(
    organizationId: string,
    plan: string,
    status: string,
  ) {
    await getDb().$client.query(
      `insert into auth.subscription (plan, reference_id, status, period_end)
       values ($1, $2, $3, now() + interval '30 days')`,
      [plan, organizationId, status],
    );
  }

  test("should refuse invitations past the free tier's seats, counting open invitations", async () => {
    const { headers } = await signUpVerifiedUser("seat-owner");
    const organizationId = await createOrg(headers, "seats");
    // The owner takes one seat; open invitations fill the rest.
    for (let seat = 1; seat < FREE_LIMITS.seats; seat++) {
      await auth.api.createInvitation({
        headers,
        body: {
          organizationId,
          email: testEmail(`seat-${seat}`),
          role: "member",
        },
      });
    }
    await assert.rejects(
      auth.api.createInvitation({
        headers,
        body: { organizationId, email: testEmail("seat-over"), role: "member" },
      }),
      (error: { body?: { code?: string } }) =>
        error.body?.code === SEAT_LIMIT_ERROR_CODE,
    );
  });

  test("should unlock a plan only while its subscription is active or trialing", async () => {
    const { headers } = await signUpVerifiedUser("plan-owner");
    const organizationId = await createOrg(headers, "plans");
    const pro = PLANS.find((plan) => plan.name === "pro");
    assert.ok(pro);

    assert.equal((await getOrganizationPlan(organizationId)).name, FREE_PLAN);
    // A direct debit that hasn't cleared yet unlocks nothing.
    await subscribe(organizationId, pro.name, "incomplete");
    assert.equal((await getOrganizationPlan(organizationId)).name, FREE_PLAN);

    await subscribe(organizationId, pro.name, "active");
    const plan = await getOrganizationPlan(organizationId);
    assert.equal(plan.name, pro.name);
    assert.deepEqual(plan.limits, pro.limits);
  });

  // The plugin passes its endpoint context; only the body matters to the guard.
  function asBillingCall(body: Record<string, unknown>) {
    return { body } as unknown as Parameters<
      typeof authorizeOrganizationBilling
    >[1];
  }

  test("should let only the organization's owner change its billing", async () => {
    const owner = await signUpVerifiedUser("billing-auth-owner");
    const outsider = await signUpVerifiedUser("billing-auth-outsider");
    const organizationId = await createOrg(owner.headers, "billing-auth");
    const call = (
      userId: string,
      action: "upgrade-subscription" | "list-subscription",
    ) =>
      authorizeOrganizationBilling(
        {
          user: { id: userId } as never,
          session: {} as never,
          referenceId: organizationId,
          action,
        },
        asBillingCall({ customerType: "organization" }),
      );
    assert.equal(await call(owner.userId, "upgrade-subscription"), true);
    assert.equal(await call(outsider.userId, "list-subscription"), false);
    assert.equal(await call(outsider.userId, "upgrade-subscription"), false);
  });

  test("should refuse a new checkout while a subscription is still live", async () => {
    const owner = await signUpVerifiedUser("billing-live-owner");
    const organizationId = await createOrg(owner.headers, "billing-live");
    await getDb().$client.query(
      `insert into auth.subscription (plan, reference_id, status, stripe_subscription_id)
       values ('starter', $1, 'past_due', $2)`,
      [organizationId, `sub_test_${RUN_ID}`],
    );
    const upgrade = (body: Record<string, unknown>) =>
      authorizeOrganizationBilling(
        {
          user: { id: owner.userId } as never,
          session: {} as never,
          referenceId: organizationId,
          action: "upgrade-subscription",
        },
        asBillingCall({ customerType: "organization", ...body }),
      );
    assert.equal(await upgrade({}), false);
    assert.equal(await upgrade({ subscriptionId: `sub_test_${RUN_ID}` }), true);
  });

  test("should let an invitee take the organization's last seat", async () => {
    const owner = await signUpVerifiedUser("last-seat-owner");
    const organizationId = await createOrg(owner.headers, "last-seat");
    // The owner holds one seat; invitations fill the rest of the free tier.
    const invitees = [];
    for (let seat = 1; seat < FREE_LIMITS.seats; seat++) {
      const email = testEmail(`last-seat-${seat}`);
      const invitation = await auth.api.createInvitation({
        headers: owner.headers,
        body: { organizationId, email, role: "member" },
      });
      invitees.push({ name: `last-seat-${seat}`, id: invitation.id });
    }
    const last = invitees.at(-1);
    assert.ok(last);
    const invitee = await signUpVerifiedUser(last.name);
    await auth.api.acceptInvitation({
      headers: invitee.headers,
      body: { invitationId: last.id },
    });
    const plan = await getOrganizationPlan(organizationId);
    assert.equal(plan.limits.seats, FREE_LIMITS.seats);
  });

  test("should queue a failed auth email for retry instead of losing it", async () => {
    const queued: AuthJob[] = [];
    const flakyAuth = createAuth({
      appName: "__NAME__-test",
      secret: process.env.BETTER_AUTH_SECRET ?? FALLBACK_TEST_SECRET,
      origins: resolveAuthOrigins({
        NODE_ENV: "test",
        BETTER_AUTH_URL: BASE_URL,
      }),
      sendEmail: async () => {
        throw new Error("mail provider down");
      },
      enqueue: async (job) => {
        queued.push(job);
      },
    });
    const email = testEmail("flaky-mail");
    await flakyAuth.api.signUpEmail({
      body: { name: "Flaky", email, password: PASSWORD },
    });
    const retry = queued.find((job) => job.type === "send-email");
    assert.ok(retry && retry.type === "send-email");
    assert.equal(retry.email.kind, "verify-email");
    assert.equal(retry.email.to, email);
    // Retries stop when the verification link would no longer work.
    assert.ok(retry.notAfter > Date.now());
    assert.ok(
      retry.notAfter <=
        Date.now() + AUTH_EMAIL_LINK_LIFETIME_SECONDS["verify-email"] * 1000,
    );
  });

  test("should queue Stripe cancellation when an organization with a live plan is deleted", async () => {
    const queued: AuthJob[] = [];
    const billingAuth = createAuth({
      appName: "__NAME__-test",
      secret: process.env.BETTER_AUTH_SECRET ?? FALLBACK_TEST_SECRET,
      origins: resolveAuthOrigins({
        NODE_ENV: "test",
        BETTER_AUTH_URL: BASE_URL,
      }),
      sendEmail: async (sent) => {
        outbox.push(sent);
      },
      // Never called: the queue takes the work, so no Stripe request is made.
      stripe: { secretKey: "sk_test_unused", webhookSecret: "whsec_unused" },
      enqueue: async (job) => {
        queued.push(job);
      },
    });
    const owner = await signUpVerifiedUser("billing-delete-owner");
    const organizationId = await createOrg(owner.headers, "billing-delete");
    const stripeSubscriptionId = `sub_delete_${RUN_ID}`;
    // Clearing: live, but the plugin's own delete guard (paid plans) doesn't block it.
    await getDb().$client.query(
      `insert into auth.subscription (plan, reference_id, status, stripe_subscription_id)
       values ('starter', $1, 'incomplete', $2)`,
      [organizationId, stripeSubscriptionId],
    );
    await billingAuth.api.deleteOrganization({
      headers: owner.headers,
      body: { organizationId },
    });
    assert.deepEqual(queued, [
      {
        type: "cancel-subscriptions",
        stripeSubscriptionIds: [stripeSubscriptionId],
      },
    ]);
  });

  test("should delete only auth records that are already past their end", async () => {
    const client = getDb().$client;
    const identifier = `cleanup-${RUN_ID}`;
    await client.query(
      `insert into auth.verification (identifier, value, expires_at) values
         ($1, 'expired', now() - interval '1 minute'),
         ($1, 'live', now() + interval '1 hour')`,
      [identifier],
    );
    const owner = await signUpVerifiedUser("cleanup-owner");
    const organizationId = await createOrg(owner.headers, "cleanup");
    await client.query(
      `insert into auth.invitation (organization_id, email, role, status, expires_at, inviter_id) values
         ($1, $2, 'member', 'pending', now() - interval '31 days', $3),
         ($1, $4, 'member', 'pending', now() - interval '1 day', $3)`,
      [
        organizationId,
        testEmail("old-invite"),
        owner.userId,
        testEmail("recent-invite"),
      ],
    );
    await deleteExpiredAuthRecords();
    const { rows: verifications } = await client.query<{ value: string }>(
      "select value from auth.verification where identifier = $1",
      [identifier],
    );
    assert.deepEqual(
      verifications.map((row) => row.value),
      ["live"],
    );
    const { rows: invitations } = await client.query<{ email: string }>(
      "select email from auth.invitation where organization_id::text = $1",
      [organizationId],
    );
    assert.deepEqual(
      invitations.map((row) => row.email),
      [testEmail("recent-invite")],
    );
    await client.query("delete from auth.verification where identifier = $1", [
      identifier,
    ]);
  });
});
