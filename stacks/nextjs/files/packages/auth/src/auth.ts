import { getDb } from "@__NAME__/db";
import * as schema from "@__NAME__/db/schema";
import { consumeWithFallback, isRateLimitConfigured } from "@__NAME__/ratelimit";
import { apiKey } from "@better-auth/api-key";
import { tryGetCurrentAuthEndpointContext } from "@better-auth/core/context";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { stripe } from "@better-auth/stripe";
import {
  type BetterAuthOptions,
  type BetterAuthPlugin,
  betterAuth,
} from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import {
  admin,
  haveIBeenPwned,
  jwt,
  magicLink,
  organization,
  twoFactor,
} from "better-auth/plugins";
import Stripe from "stripe";
import { ac, ORG_ROLES, OWNER_ROLE } from "./access.ts";
import {
  assertSeatAvailable,
  authorizeOrganizationBilling,
  cancelStripeSubscriptions,
  checkoutSessionParams,
  getOrganizationPlan,
  liveSubscriptionIds,
} from "./billing.ts";
import {
  API_KEY_PREFIX,
  AUTH_BASE_PATH,
  AUTH_DB_SCHEMA,
  AUTH_EMAIL_LINK_LIFETIME_SECONDS,
  AUTH_PAGES,
  AUTH_RATE_LIMIT_SCOPE,
  BOT_CHECKED_AUTH_PATHS,
  BOT_DETECTED_ERROR_CODE,
  EMAIL_VERIFICATION_EXPIRES_IN_SECONDS,
  INVITATION_EXPIRES_IN_SECONDS,
  INVITE_MEMBER_PATH,
  INVITE_RATE_LIMIT,
  MAGIC_LINK_EXPIRES_IN_SECONDS,
  PASSWORD_POLICY,
  PLANS,
  SERVICE_TOKEN_AUDIENCE,
  SERVICE_TOKEN_POLICY,
  SESSION_POLICY,
  SOLE_OWNER_ERROR_CODE,
  STRIPE_WEBHOOK_PATH,
  SUBSCRIPTION_PATH_PREFIX,
  TRUSTED_DEVICE_MAX_AGE_SECONDS,
} from "./config.ts";
import {
  AuthEmailNotConfiguredError,
  devConsoleEmailSender,
  type SendAuthEmail,
} from "./email.ts";
import { type AuthEvent, type AuthEventSink, noopEventSink } from "./events.ts";
import type { EnqueueAuthJob } from "./jobs.ts";
import type { AuthOrigins } from "./origins.ts";

// Better Auth's `consume` maps onto the shared limiter; the key already names the IP and path.
// If Upstash fails, counting drops to per-instance memory, so sign-in is never left unlimited.
const upstashRateLimitStorage = {
  consume: async (key, rule) => {
    const result = await consumeWithFallback(AUTH_RATE_LIMIT_SCOPE, key, {
      max: rule.max,
      windowSeconds: rule.window,
    });
    return { allowed: result.allowed, retryAfter: result.retryAfterSeconds };
  },
} satisfies NonNullable<
  NonNullable<BetterAuthOptions["rateLimit"]>["customStorage"]
>;

export type CreateAuthConfig = {
  appName: string;
  secret: string;
  // From resolveAuthOrigins(): this environment's own hosts and its canonical origin.
  origins: AuthOrigins;
  // Required in production; the dev sender prints links.
  sendEmail?: SendAuthEmail;
  onEvent?: AuthEventSink;
  // Keeps the function alive for work Better Auth defers past the response (emails), e.g.
  // Next's after() or waitUntil(). Without it that work is awaited inline.
  runInBackground?: (promise: Promise<unknown>) => void;
  // Hands retryable work (failed emails, Stripe cancellations) to the app's job queue. Unset:
  // emails fail as before and cancellations are tried once.
  enqueue?: EnqueueAuthJob;
  // Organization billing. Unset: no Stripe plugin, every organization is on the free tier.
  stripe?: { secretKey: string; webhookSecret: string };
  // Bot check for BOT_CHECKED_AUTH_PATHS on HTTP requests (apps/web: Vercel BotID). Unset: no
  // check. Server-side `auth.api` calls have no browser behind them and are never checked.
  isBot?: () => Promise<boolean>;
  // Framework glue appended last, e.g. nextCookies() in apps/web.
  plugins?: BetterAuthPlugin[];
};

// Logs carry only an error's name: messages can echo emails, links, or request bodies.
function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

// The signed-in user of the request being handled (Better Auth runs every endpoint inside an
// async-local context). Null for webhooks, jobs, and direct adapter calls.
function currentActorId(): string | null {
  return tryGetCurrentAuthEndpointContext()?.context.session?.user.id ?? null;
}

const API_KEY_CREATE_PATH = "/api-key/create";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Endpoints that finish a sign-in (social sign-in finishes on the OAuth callback).
const SIGN_IN_PATHS: ReadonlySet<string> = new Set([
  "/sign-in/email",
  "/magic-link/verify",
  "/verify-email",
  "/two-factor/verify-totp",
  "/two-factor/verify-otp",
  "/two-factor/verify-backup-code",
]);
const OAUTH_CALLBACK_PREFIX = "/callback/";

function isSignInPath(path: string): boolean {
  return SIGN_IN_PATHS.has(path) || path.startsWith(OAUTH_CALLBACK_PREFIX);
}

// Endpoints where someone ends sessions on purpose.
const SESSION_END_PATHS: ReadonlySet<string> = new Set([
  "/sign-out",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
]);

function isSessionEndPath(path: string | undefined): boolean {
  return path !== undefined && SESSION_END_PATHS.has(path);
}
const API_KEY_DELETE_PATH = "/api-key/delete";

// A Stripe event for a one-off payment Checkout Session (the shop). The webhook endpoint keeps
// the raw body for its signature check, so a clone is read. Unverified here, and nothing is done
// with it: it is only acknowledged so the billing plugin doesn't process it.
async function isShopSessionEvent(
  request: Request | undefined,
): Promise<boolean> {
  if (!request) return false;
  const body = (await request
    .clone()
    .json()
    .catch(() => null)) as {
    data?: { object?: { object?: unknown; mode?: unknown } };
  } | null;
  const object = body?.data?.object;
  return object?.object === "checkout.session" && object.mode === "payment";
}

// Magic links sign in without a password and Better Auth's two-factor hook doesn't cover them,
// so accounts with two-factor on never get or use one.
const MAGIC_LINK_VERIFY_PATH = "/magic-link/verify";

async function hasTwoFactor(
  where: { email: string } | { userId: string },
): Promise<boolean> {
  const [column, value] =
    "email" in where
      ? ["lower(email)", where.email.toLowerCase()]
      : ["id::text", where.userId];
  const { rows } = await getDb().$client.query<{
    two_factor_enabled: boolean | null;
  }>(
    `select two_factor_enabled from ${AUTH_DB_SCHEMA}."user" where ${column} = $1`,
    [value],
  );
  return rows[0]?.two_factor_enabled === true;
}

// Deleting a user removes their memberships but not their organizations. An organization left
// with no owner keeps working API keys nobody can see or revoke, so before a user goes:
// organizations they own alone with nobody else in them are deleted (keys first; they have no
// foreign key), and owning one alone with other members blocks the deletion.
// Returns the ids of the organizations it deleted.
async function releaseSoleOwnedOrganizations(
  userId: string,
  stopBilling: (organizationIds: readonly string[]) => Promise<void>,
): Promise<string[]> {
  const client = getDb().$client;
  const { rows } = await client.query<{
    id: string;
    owners: number;
    members: number;
  }>(
    `select m.organization_id::text as id,
       (select count(*)::int from ${AUTH_DB_SCHEMA}.member o
         where o.organization_id = m.organization_id
           and $2 = any(string_to_array(o.role, ','))) as owners,
       (select count(*)::int from ${AUTH_DB_SCHEMA}.member o
         where o.organization_id = m.organization_id) as members
     from ${AUTH_DB_SCHEMA}.member m
     where m.user_id::text = $1 and $2 = any(string_to_array(m.role, ','))`,
    [userId, OWNER_ROLE],
  );
  const soleOwned = rows.filter((org) => org.owners === 1);
  if (soleOwned.some((org) => org.members > 1)) {
    throw new APIError("BAD_REQUEST", {
      code: SOLE_OWNER_ERROR_CODE,
      message:
        "Make someone else an owner of your organizations before deleting your account.",
    });
  }
  const ids = soleOwned.map((org) => org.id);
  if (ids.length === 0) return ids;
  await client.query(
    `delete from ${AUTH_DB_SCHEMA}.apikey where reference_id = any($1::text[])`,
    [ids],
  );
  // Deleted with SQL, so the organization plugin's delete hook doesn't run: stop billing here.
  await stopBilling(ids);
  await client.query(
    `delete from ${AUTH_DB_SCHEMA}.organization where id::text = any($1::text[])`,
    [ids],
  );
  return ids;
}

// One Better Auth setup for every runtime (Next.js app, tests, scripts). App users only; CMS
// staff sign in to Payload separately. Opens the database pool, so callers create it lazily
// (apps/web getAuth()) to keep `next build` free of database env vars.
export function createAuth(config: CreateAuthConfig) {
  if (!config.sendEmail && process.env.NODE_ENV === "production") {
    // Otherwise sign-ups succeed but nobody can verify, and the failure only shows in logs.
    throw new AuthEmailNotConfiguredError(
      "createAuth: pass sendEmail in production (no email provider configured)",
    );
  }
  const deliver = config.sendEmail ?? devConsoleEmailSender;
  // A failed first send is queued for retry when the app has a job queue; the first attempt stays
  // inline so sign-in and verification links aren't delayed by the queue.
  const send: SendAuthEmail = async (email) => {
    try {
      await deliver(email);
    } catch (error) {
      if (!config.enqueue) throw error;
      const notAfter =
        Date.now() + AUTH_EMAIL_LINK_LIFETIME_SECONDS[email.kind] * 1000;
      try {
        await config.enqueue({ type: "send-email", email, notAfter });
      } catch (queueError) {
        console.error("[auth] email failed and couldn't be queued", {
          kind: email.kind,
          error: errorName(error),
          queueError: errorName(queueError),
        });
        throw error;
      }
      console.error("[auth] email failed, queued for retry", {
        kind: email.kind,
        error: errorName(error),
      });
    }
  };

  // Stops billing for organizations being deleted: queued (and retried) when the app has a job
  // queue, otherwise tried once. Never throws: deletion and key cleanup must still finish.
  async function stopBilling(
    organizationIds: readonly string[],
  ): Promise<void> {
    if (!config.stripe) return;
    const ids = await liveSubscriptionIds(organizationIds);
    if (ids.length === 0) return;
    try {
      if (config.enqueue) {
        await config.enqueue({
          type: "cancel-subscriptions",
          stripeSubscriptionIds: ids,
        });
      } else {
        await cancelStripeSubscriptions(config.stripe.secretKey, ids);
      }
    } catch (error) {
      console.error(
        "[billing] couldn't stop billing for deleted organizations",
        {
          count: ids.length,
          error: errorName(error),
        },
      );
    }
  }

  const sink = config.onEvent ?? noopEventSink;
  // Events feed analytics and the audit log; a failing sink must never block sign-in or a change.
  const emit = async (event: AuthEvent): Promise<void> => {
    try {
      await sink(event);
    } catch (error) {
      console.error("[auth] event sink failed", {
        type: event.type,
        error: errorName(error),
      });
    }
  };
  // Changes seen in a `before` database hook, reported in the matching `after` hook once the
  // write succeeded. Keyed by the endpoint context, which both hooks receive.
  const pendingTwoFactor = new WeakMap<object, boolean>();
  const pendingPassword = new WeakSet<object>();
  const hasUserId = (value: unknown): value is { userId: string } =>
    typeof value === "object" &&
    value !== null &&
    typeof (value as { userId?: unknown }).userId === "string";
  const emitSubscriptionChanged = (subscription: {
    referenceId: string;
    plan: string;
    status: string;
  }) =>
    emit({
      type: "subscription.changed",
      actorId: null,
      organizationId: subscription.referenceId,
      plan: subscription.plan,
      status: subscription.status,
    });
  // An API key's organization and name, read before deletion (the after hook can't see the row).
  // Keyed by key id; the after hook removes the entry whether or not the delete succeeded.
  const deletingApiKeys = new Map<
    string,
    { organizationId: string; name: string | null }
  >();
  const { canonical, allowedHosts } = config.origins;
  // SDK default API version: the one this stripe release is typed against.
  const stripeClient = config.stripe
    ? new Stripe(config.stripe.secretKey)
    : null;

  return betterAuth({
    appName: config.appName,
    secret: config.secret,
    baseURL: { allowedHosts, fallback: canonical },
    basePath: AUTH_BASE_PATH,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema,
      schemaName: AUTH_DB_SCHEMA,
    }),
    advanced: {
      database: { generateId: "uuid" },
      ...(config.runInBackground && {
        backgroundTasks: { handler: config.runInBackground },
      }),
    },
    hooks: {
      // Without a referenceId the Stripe plugin bills the signed-in user and skips
      // authorizeReference entirely. Organizations pay, never users, so that path is closed.
      before: createAuthMiddleware(async (ctx) => {
        // The shop's Checkout Sessions (mode `payment`) reach this webhook too, since both share
        // the Stripe account; the Stripe plugin assumes every completed session is a
        // subscription and logs an error. They belong to the shop webhook (apps/web).
        if (
          ctx.path === STRIPE_WEBHOOK_PATH &&
          (await isShopSessionEvent(ctx.request))
        ) {
          return ctx.json({ received: true });
        }
        if (
          config.isBot &&
          ctx.request &&
          (BOT_CHECKED_AUTH_PATHS as readonly string[]).includes(ctx.path) &&
          (await config.isBot())
        ) {
          throw new APIError("FORBIDDEN", {
            code: BOT_DETECTED_ERROR_CODE,
            message: "This request looked automated.",
          });
        }
        if (ctx.path === API_KEY_DELETE_PATH) {
          const keyId: unknown = ctx.body?.keyId;
          // Checked first: casting a malformed id would fail the request with a 500.
          if (typeof keyId !== "string" || !UUID_PATTERN.test(keyId)) return;
          const { rows } = await getDb().$client.query<{
            reference_id: string;
            name: string | null;
          }>(
            `select reference_id, name from ${AUTH_DB_SCHEMA}.apikey where id = $1::uuid`,
            [keyId],
          );
          const key = rows[0];
          if (key) {
            deletingApiKeys.set(keyId, {
              organizationId: key.reference_id,
              name: key.name,
            });
          }
          return;
        }
        if (!ctx.path.startsWith(SUBSCRIPTION_PATH_PREFIX)) return;
        const referenceId = ctx.body?.referenceId ?? ctx.query?.referenceId;
        if (!referenceId) {
          throw new APIError("BAD_REQUEST", {
            message: "Billing belongs to an organization: pass its id.",
          });
        }
      }),
      // Sign-ins and API keys have no database hook that tells the whole story: record them here.
      after: createAuthMiddleware(async (ctx) => {
        // Only a finished sign-in: the password step of a two-factor sign-in answers with a
        // redirect, and its session is replaced once the second factor checks out.
        const newSession = ctx.context.newSession;
        const returned = ctx.context.returned as
          | { twoFactorRedirect?: boolean }
          | undefined;
        if (
          newSession &&
          isSignInPath(ctx.path) &&
          !returned?.twoFactorRedirect
        ) {
          await emit({
            type: "user.signed_in",
            userId: newSession.user.id,
            sessionId: newSession.session.id,
          });
          return;
        }
        if (ctx.path === API_KEY_CREATE_PATH) {
          const created = ctx.context.returned as
            | { id?: string; name?: string | null; referenceId?: string }
            | undefined;
          if (created?.id && created.referenceId) {
            await emit({
              type: "api_key.created",
              actorId: currentActorId(),
              organizationId: created.referenceId,
              keyId: created.id,
              name: created.name ?? null,
            });
          }
          return;
        }
        if (ctx.path === API_KEY_DELETE_PATH) {
          const keyId: unknown = ctx.body?.keyId;
          if (typeof keyId !== "string") return;
          const key = deletingApiKeys.get(keyId);
          deletingApiKeys.delete(keyId);
          const deleted = ctx.context.returned as
            | { success?: boolean }
            | undefined;
          if (key && deleted?.success) {
            await emit({
              type: "api_key.deleted",
              actorId: currentActorId(),
              organizationId: key.organizationId,
              keyId,
              name: key.name,
            });
          }
        }
      }),
    },
    // In-memory counters reset per serverless instance, so counts are shared: in Upstash when
    // configured (no Postgres write per request), else in the database (`auth.rate_limit`).
    rateLimit: {
      enabled: true,
      storage: "database",
      ...(isRateLimitConfigured() && {
        customStorage: upstashRateLimitStorage,
      }),
      customRules: {
        [INVITE_MEMBER_PATH]: {
          window: INVITE_RATE_LIMIT.windowSeconds,
          max: INVITE_RATE_LIMIT.max,
        },
        // Stripe retries from a few shared IPs; signatures, not IPs, authenticate the webhook.
        [STRIPE_WEBHOOK_PATH]: false,
      },
    },
    session: {
      expiresIn: SESSION_POLICY.expiresInSeconds,
      updateAge: SESSION_POLICY.updateAgeSeconds,
      cookieCache: {
        enabled: true,
        maxAge: SESSION_POLICY.cookieCacheMaxAgeSeconds,
        strategy: "compact",
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: PASSWORD_POLICY.minLength,
      resetPasswordTokenExpiresIn: PASSWORD_POLICY.resetLinkExpiresInSeconds,
      revokeSessionsOnPasswordReset: PASSWORD_POLICY.revokeSessionsOnReset,
      // The sign-up screen can't say "this email is taken" without leaking which emails exist,
      // so the owner gets an email instead.
      onExistingUserSignUp: async ({ user }) => {
        const url = new URL(AUTH_PAGES.signIn, canonical).toString();
        await send({ kind: "account-exists", to: user.email, url });
      },
      sendResetPassword: async ({ user, url }) => {
        await send({ kind: "reset-password", to: user.email, url });
      },
      // A reset writes the password through a bulk update whose hook gets no row, so it's
      // recorded here (the account hooks below cover change and set).
      onPasswordReset: async ({ user }) => {
        await emit({ type: "user.password_changed", userId: user.id });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: EMAIL_VERIFICATION_EXPIRES_IN_SECONDS,
      sendVerificationEmail: async ({ user, url }) => {
        await send({ kind: "verify-email", to: user.email, url });
      },
    },
    // Self-service account deletion (GDPR erasure). The user.deleted event fires from the
    // database hook below, so admin removals emit it too.
    user: { deleteUser: { enabled: true } },
    databaseHooks: {
      user: {
        create: {
          after: async (user) =>
            emit({ type: "user.created", userId: user.id }),
        },
        update: {
          before: async (data, context) => {
            if (context && typeof data.twoFactorEnabled === "boolean") {
              pendingTwoFactor.set(context, data.twoFactorEnabled);
            }
          },
          after: async (user, context) => {
            const enabled = context ? pendingTwoFactor.get(context) : undefined;
            if (context) pendingTwoFactor.delete(context);
            if (!user) return;
            await emit({ type: "user.updated", userId: user.id });
            if (enabled !== undefined) {
              await emit({
                type: "user.two_factor_changed",
                userId: user.id,
                enabled,
              });
            }
          },
        },
        // Where Payload and analytics cleanup hook in (GDPR phase).
        delete: {
          before: async (user) => {
            const deleted = await releaseSoleOwnedOrganizations(
              user.id,
              stopBilling,
            );
            for (const organizationId of deleted) {
              await emit({
                type: "organization.deleted",
                actorId: user.id,
                organizationId,
              });
            }
          },
          after: async (user) =>
            emit({ type: "user.deleted", userId: user.id, email: user.email }),
        },
      },
      // Password change, reset, and set all write the credential account's password.
      account: {
        update: {
          before: async (data, context) => {
            if (context && typeof data.password === "string") {
              pendingPassword.add(context);
            }
          },
          after: async (account, context) => {
            const changed = context ? pendingPassword.delete(context) : false;
            if (changed && hasUserId(account)) {
              await emit({
                type: "user.password_changed",
                userId: account.userId,
              });
            }
          },
        },
      },
      session: {
        create: {
          before: async (session, context) => {
            if (
              context?.path === MAGIC_LINK_VERIFY_PATH &&
              (await hasTwoFactor({ userId: session.userId }))
            ) {
              return false;
            }
          },
          after: async (session) =>
            emit({
              type: "session.created",
              userId: session.userId,
              sessionId: session.id,
            }),
        },
        delete: {
          after: async (session, context) =>
            emit({
              type: "session.revoked",
              userId: session.userId,
              sessionId: session.id,
              // Sign-out and revoking devices, not sessions replaced by two-factor or a reset.
              userInitiated: isSessionEndPath(context?.path),
            }),
        },
      },
    },
    plugins: [
      organization({
        ac,
        roles: ORG_ROLES,
        invitationExpiresIn: INVITATION_EXPIRES_IN_SECONDS,
        // The plugin's own cap (default 100 members) follows the plan, so it never undercuts a
        // larger plan; the seat hooks below also count open invitations.
        membershipLimit: async (_user, org) =>
          (await getOrganizationPlan(org.id)).limits.seats,
        sendInvitationEmail: async ({
          email,
          id,
          organization,
          inviter,
          role,
        }) => {
          const url = new URL(
            `${AUTH_PAGES.acceptInvitation}/${id}`,
            canonical,
          );
          await send({
            kind: "org-invitation",
            to: email,
            url: url.toString(),
            invitation: {
              organizationName: organization.name,
              inviterName: inviter.user.name || inviter.user.email,
              role,
            },
          });
        },
        organizationHooks: {
          afterCreateOrganization: async ({ organization: created, user }) => {
            await emit({
              type: "organization.created",
              actorId: user.id,
              organizationId: created.id,
            });
          },
          afterUpdateOrganization: async ({ organization: updated, user }) => {
            if (!updated) return;
            await emit({
              type: "organization.updated",
              actorId: user.id,
              organizationId: updated.id,
            });
          },
          afterAddMember: async ({ member, organization: org }) => {
            await emit({
              type: "member.added",
              actorId: currentActorId(),
              organizationId: org.id,
              memberUserId: member.userId,
              role: member.role,
            });
          },
          afterRemoveMember: async ({ member, organization: org }) => {
            await emit({
              type: "member.removed",
              actorId: currentActorId(),
              organizationId: org.id,
              memberUserId: member.userId,
              role: member.role,
            });
          },
          afterUpdateMemberRole: async ({
            member,
            previousRole,
            organization: org,
          }) => {
            await emit({
              type: "member.role_changed",
              actorId: currentActorId(),
              organizationId: org.id,
              memberUserId: member.userId,
              role: member.role,
              previousRole,
            });
          },
          afterCreateInvitation: async ({
            invitation,
            inviter,
            organization: org,
          }) => {
            await emit({
              type: "invitation.created",
              actorId: inviter.id,
              organizationId: org.id,
              invitationId: invitation.id,
              role: invitation.role,
            });
          },
          afterAcceptInvitation: async ({
            invitation,
            user,
            organization: org,
          }) => {
            await emit({
              type: "invitation.accepted",
              actorId: user.id,
              organizationId: org.id,
              invitationId: invitation.id,
              role: invitation.role,
            });
          },
          afterRejectInvitation: async ({
            invitation,
            user,
            organization: org,
          }) => {
            await emit({
              type: "invitation.rejected",
              actorId: user.id,
              organizationId: org.id,
              invitationId: invitation.id,
              role: invitation.role,
            });
          },
          afterCancelInvitation: async ({
            invitation,
            cancelledBy,
            organization: org,
          }) => {
            await emit({
              type: "invitation.canceled",
              actorId: cancelledBy.id,
              organizationId: org.id,
              invitationId: invitation.id,
              role: invitation.role,
            });
          },
          // Seats come from the plan (billing.ts); open invitations count against them.
          beforeAddMember: async ({ organization: org }) => {
            await assertSeatAvailable(org.id);
          },
          beforeCreateInvitation: async ({ organization: org }) => {
            await assertSeatAvailable(org.id);
          },
          beforeAcceptInvitation: async ({ organization: org }) => {
            await assertSeatAvailable(org.id, 1);
          },
          // Org keys reference the org by id without a foreign key; without this they would keep
          // verifying after the organization is gone.
          // Keys first: a Stripe failure must never leave them working for a deleted org.
          afterDeleteOrganization: async ({ organization: deleted, user }) => {
            await emit({
              type: "organization.deleted",
              actorId: user.id,
              organizationId: deleted.id,
            });
            await getDb().$client.query(
              `delete from ${AUTH_DB_SCHEMA}.apikey where reference_id = $1`,
              [deleted.id],
            );
            await stopBilling([deleted.id]);
          },
        },
      }),
      // App-wide roles for our own support staff (ban, impersonate); customers use org roles.
      admin(),
      apiKey({ references: "organization", defaultPrefix: API_KEY_PREFIX }),
      jwt({
        jwks: {
          keyPairConfig: { alg: "EdDSA", crv: "Ed25519" },
          rotationInterval: SERVICE_TOKEN_POLICY.rotationIntervalSeconds,
          gracePeriod: SERVICE_TOKEN_POLICY.gracePeriodSeconds,
        },
        jwt: {
          // Fixed values: with a dynamic baseURL the defaults follow the request host.
          issuer: canonical,
          audience: SERVICE_TOKEN_AUDIENCE,
          expirationTime: SERVICE_TOKEN_POLICY.expirationTime,
          // Only what services need, plus who is really acting during impersonation.
          definePayload: ({ user, session }) => ({
            email: user.email,
            role: user.role ?? null,
            impersonatedBy: session.impersonatedBy ?? null,
          }),
        },
      }),
      twoFactor({
        issuer: config.appName,
        trustDeviceMaxAge: TRUSTED_DEVICE_MAX_AGE_SECONDS,
      }),
      magicLink({
        expiresIn: MAGIC_LINK_EXPIRES_IN_SECONDS,
        sendMagicLink: async ({ email, url }) => {
          if (await hasTwoFactor({ email })) return;
          await send({ kind: "magic-link", to: email, url });
        },
      }),
      haveIBeenPwned(),
      // Last before the framework glue: a conditional entry mid-list would widen the plugin
      // tuple and drop other plugins' inferred fields (twoFactorEnabled).
      ...(stripeClient && config.stripe
        ? [
            stripe({
              stripeClient,
              stripeWebhookSecret: config.stripe.webhookSecret,
              // Organizations pay; a customer is created on their first checkout.
              createCustomerOnSignUp: false,
              organization: { enabled: true },
              subscription: {
                enabled: true,
                plans: PLANS.map((plan) => ({ ...plan })),
                requireEmailVerification: true,
                authorizeReference: authorizeOrganizationBilling,
                getCheckoutSessionParams: async () => ({
                  params: await checkoutSessionParams(stripeClient),
                }),
                // Webhook-driven, so there's no signed-in actor.
                onSubscriptionComplete: async ({ subscription }) =>
                  emitSubscriptionChanged(subscription),
                onSubscriptionUpdate: async ({ subscription }) =>
                  emitSubscriptionChanged(subscription),
                onSubscriptionCancel: async ({ subscription }) =>
                  emitSubscriptionChanged(subscription),
                onSubscriptionDeleted: async ({ subscription }) =>
                  emitSubscriptionChanged(subscription),
              },
            }),
          ]
        : []),
      ...(config.plugins ?? []),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
