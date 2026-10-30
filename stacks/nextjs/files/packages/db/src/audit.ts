import type pg from "pg";
import { AUDIT_PARTITIONS_AHEAD, AUDIT_RETENTION_MONTHS } from "./config.ts";

// The audit log (migration 0015): append-only, partitioned by UTC month, kept for
// AUDIT_RETENTION_MONTHS. Rows hold ids and small facts only, never emails, names, or IPs, so
// once an account is deleted its events no longer identify anyone (docs/knowledge/compliance.md).

// Every action the app records, grouped by category for filtering. Single source: emitters,
// the Activity page, and the export all use these strings.
export const AUDIT_ACTIONS = {
  account: [
    "user.signed_up",
    "user.signed_in",
    "user.session_revoked",
    "user.password_changed",
    "user.two_factor_enabled",
    "user.two_factor_disabled",
    "user.data_exported",
    "user.deleted",
  ],
  organization: [
    "organization.created",
    "organization.updated",
    "organization.deleted",
  ],
  members: [
    "member.added",
    "member.removed",
    "member.role_changed",
    "invitation.created",
    "invitation.accepted",
    "invitation.canceled",
    "invitation.rejected",
  ],
  apiKeys: ["api_key.created", "api_key.deleted"],
  billing: ["subscription.changed"],
  commerce: ["order.created", "order.refunded"],
} as const;

export type AuditCategory = keyof typeof AUDIT_ACTIONS;
export type AuditAction = (typeof AUDIT_ACTIONS)[AuditCategory][number];

export const AUDIT_CATEGORIES = Object.keys(AUDIT_ACTIONS) as AuditCategory[];

// Null for an action no longer in AUDIT_ACTIONS: rows are kept for months and never rewritten,
// so a renamed or removed action must still display.
export function auditCategoryOf(action: string): AuditCategory | null {
  return (
    AUDIT_CATEGORIES.find((key) =>
      (AUDIT_ACTIONS[key] as readonly string[]).includes(action),
    ) ?? null
  );
}

// Metadata stays small and flat: roles, plan names, key names. Never personal data.
export type AuditMetadata = Record<string, string | number | boolean | null>;

export type AuditEventInput = {
  action: AuditAction;
  actorId?: string | null;
  organizationId?: string | null;
  target?: { type: string; id: string } | null;
  metadata?: AuditMetadata;
};

export type AuditEvent = {
  id: string;
  occurredAt: Date;
  action: AuditAction;
  actorId: string | null;
  organizationId: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: AuditMetadata;
};

type Queryable = Pick<pg.Pool, "query">;

export async function recordAuditEvent(
  client: Queryable,
  event: AuditEventInput,
): Promise<void> {
  await client.query(
    `insert into audit.events
       (action, actor_id, organization_id, target_type, target_id, metadata)
     values ($1, $2::uuid, $3::uuid, $4, $5, $6::jsonb)`,
    [
      event.action,
      event.actorId ?? null,
      event.organizationId ?? null,
      event.target?.type ?? null,
      event.target?.id ?? null,
      JSON.stringify(event.metadata ?? {}),
    ],
  );
}

// Keyset cursor: the last row of the previous page. The time is Postgres text with microseconds
// (a JS Date would drop them and skip or repeat rows written in the same millisecond).
export type AuditCursor = { occurredAt: string; id: string };

// UTC with microseconds, the format cursors carry.
const CURSOR_TIME_FORMAT = `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'`;

export type AuditPage = { events: AuditEvent[]; next: AuditCursor | null };

type AuditRow = {
  id: string;
  occurred_at: Date;
  cursor_at: string;
  action: AuditAction;
  actor_id: string | null;
  organization_id: string | null;
  target_type: string | null;
  target_id: string | null;
  metadata: AuditMetadata;
};

function toEvent(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    action: row.action,
    actorId: row.actor_id,
    organizationId: row.organization_id,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: row.metadata,
  };
}

// Newest first, for one organization or one actor. One extra row is read to know whether there's
// a next page.
export async function listAuditEvents(
  client: Queryable,
  scope: { organizationId: string } | { actorId: string },
  options: {
    limit: number;
    category?: AuditCategory | null;
    cursor?: AuditCursor | null;
  },
): Promise<AuditPage> {
  const column = "organizationId" in scope ? "organization_id" : "actor_id";
  const scopeId =
    "organizationId" in scope ? scope.organizationId : scope.actorId;
  const actions = options.category ? AUDIT_ACTIONS[options.category] : null;
  const { rows } = await client.query<AuditRow>(
    `select id, occurred_at, action, actor_id, organization_id, target_type, target_id, metadata,
            to_char(occurred_at at time zone 'UTC', ${CURSOR_TIME_FORMAT}) as cursor_at
       from audit.events
      where ${column} = $1::uuid
        and ($2::text[] is null or action = any($2::text[]))
        and ($3::timestamptz is null or (occurred_at, id) < ($3::timestamptz, $4::uuid))
      order by occurred_at desc, id desc
      limit $5`,
    [
      scopeId,
      actions,
      options.cursor?.occurredAt ?? null,
      options.cursor?.id ?? null,
      options.limit + 1,
    ],
  );
  const page = rows.slice(0, options.limit);
  const last = page.at(-1);
  return {
    events: page.map(toEvent),
    next:
      rows.length > options.limit && last
        ? { occurredAt: last.cursor_at, id: last.id }
        : null,
  };
}

export type AuditMaintenanceResult = { created: number; dropped: number };

// Daily: partitions for this month and AUDIT_PARTITIONS_AHEAD more, and partitions past the
// retention dropped whole. Safe to run twice.
export async function maintainAuditPartitions(
  client: Queryable,
  now: Date = new Date(),
): Promise<AuditMaintenanceResult> {
  const created = await client.query<{ created: number }>(
    `select count(*) filter (where audit.ensure_partition(
              (date_trunc('month', $1::timestamptz at time zone 'UTC') + make_interval(months => m))::date
            ))::int as created
       from generate_series(0, $2::int) as m`,
    [now, AUDIT_PARTITIONS_AHEAD],
  );
  const dropped = await client.query<{ dropped: number }>(
    // Month arithmetic on timestamp (no zone) so the session time zone can't shift the cutoff.
    `select audit.drop_partitions_before(
              (date_trunc('month', $1::timestamptz at time zone 'UTC')
               - make_interval(months => $2::int)) at time zone 'UTC') as dropped`,
    [now, AUDIT_RETENTION_MONTHS],
  );
  return {
    created: created.rows[0]?.created ?? 0,
    dropped: dropped.rows[0]?.dropped ?? 0,
  };
}
