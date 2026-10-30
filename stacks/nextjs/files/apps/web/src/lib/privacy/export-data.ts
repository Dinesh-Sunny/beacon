import { getDb, listAuditEvents } from "@__NAME__/db";
import { EXPORT_ROW_LIMIT } from "./config.ts";

// Everything we hold about one person, for "Download your data" (UK GDPR Art. 15 and 20; served
// by export.ts, which adds conversation messages from the sidecar). Relative imports only, so
// `node --test` runs it.
// Secrets are never included: password hashes, OAuth tokens, session tokens, TOTP secrets, and
// backup codes stay out by selecting columns explicitly. Other people's personal data stays out
// too: invitations the person sent list role and status, not the invitee's email.

export const EXPORT_FORMAT_VERSION = 1;

type Row = Record<string, unknown>;

// A section capped at EXPORT_ROW_LIMIT rows says so instead of silently stopping.
export type Section<T = Row> = { rows: T[]; truncated: boolean };

export type DataExport = {
  format: { version: number; exportedAt: string; site: string };
  profile: Row | null;
  signInMethods: Section;
  sessions: Section;
  organizations: Section;
  invitationsSent: Section;
  invitationsReceived: Section;
  consent: { subjects: Section; records: Section };
  assistantConversations: Section;
  orders: Section;
  activity: Section;
};

export async function buildDataExport(
  userId: string,
  siteName: string,
): Promise<DataExport> {
  const client = getDb().$client;
  // One row past the cap tells us whether the section was cut.
  const section = async (sql: string, params: unknown[]): Promise<Section> => {
    const { rows } = await client.query<Row>(
      `${sql} limit $${params.length + 1}`,
      [...params, EXPORT_ROW_LIMIT + 1],
    );
    return {
      rows: rows.slice(0, EXPORT_ROW_LIMIT),
      truncated: rows.length > EXPORT_ROW_LIMIT,
    };
  };

  const { rows: profiles } = await client.query<Row>(
    `select id, name, email, email_verified, image, two_factor_enabled, created_at, updated_at
       from auth."user" where id = $1::uuid`,
    [userId],
  );
  const profile = profiles[0] ?? null;
  const email = typeof profile?.email === "string" ? profile.email : null;

  const signInMethods = await section(
    `select provider_id, account_id, created_at, updated_at
       from auth.account where user_id = $1::uuid order by created_at`,
    [userId],
  );
  const sessions = await section(
    `select created_at, updated_at, expires_at, ip_address, user_agent
       from auth.session where user_id = $1::uuid order by created_at desc`,
    [userId],
  );
  const organizations = await section(
    `select o.id, o.name, o.slug, m.role, m.created_at as joined_at
       from auth.member m join auth.organization o on o.id = m.organization_id
      where m.user_id = $1::uuid order by m.created_at`,
    [userId],
  );
  const invitationsSent = await section(
    `select organization_id, role, status, created_at, expires_at
       from auth.invitation where inviter_id = $1::uuid order by created_at desc`,
    [userId],
  );
  const invitationsReceived = await section(
    `select i.organization_id, o.name as organization_name, i.role, i.status, i.created_at,
            i.expires_at
       from auth.invitation i join auth.organization o on o.id = i.organization_id
      where lower(i.email) = lower($1) order by i.created_at desc`,
    [email ?? ""],
  );
  const subjects = await section(
    `select id, "createdAt", "updatedAt" from consent.subject
      where "externalId" = $1 order by "createdAt"`,
    [userId],
  );
  const records = await section(
    `select c."subjectId", c."givenAt", c."validUntil", c."purposeIds", c."consentAction",
            c.jurisdiction, c."ipAddress", c."userAgent"
       from consent.consent c join consent.subject s on s.id = c."subjectId"
      where s."externalId" = $1 order by c."givenAt" desc`,
    [userId],
  );
  const assistantConversations = await section(
    `select id, agent, title, created_at, updated_at
       from agent_threads where user_id = $1::uuid order by updated_at desc`,
    [userId],
  );
  // Shop orders placed signed in (customer link) or as a guest with the account's email.
  const orders = await section(
    `select o.id, t.name as shop, o.status, o.amount, o.currency, o.created_at,
            o.shipping_name, o.shipping_line1, o.shipping_line2, o.shipping_city,
            o.shipping_postal_code, o.shipping_country, o.shipping_rate
       from payload.orders o
       left join payload.tenants t on t.id = o.tenant_id
       left join payload.customers c on c.id = o.customer_id
      where c.better_auth_user_id = $1 or lower(o.customer_email) = lower($2)
      order by o.created_at desc`,
    [userId, email ?? ""],
  );
  const activity = await listAuditEvents(
    client,
    { actorId: userId },
    { limit: EXPORT_ROW_LIMIT },
  );

  return {
    format: {
      version: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      site: siteName,
    },
    profile,
    signInMethods,
    sessions,
    organizations,
    invitationsSent,
    invitationsReceived,
    consent: { subjects, records },
    assistantConversations,
    orders,
    activity: {
      rows: activity.events.map((event) => ({
        occurredAt: event.occurredAt,
        action: event.action,
        organizationId: event.organizationId,
        targetType: event.targetType,
        targetId: event.targetId,
        metadata: event.metadata,
      })),
      truncated: activity.next !== null,
    },
  };
}
