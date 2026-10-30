-- Append-only audit log (docs/knowledge/compliance.md). Partitioned by month so retention drops
-- whole partitions (the only way rows ever leave) instead of deleting rows. Drizzle can't model a
-- partitioned table, so it's hand-written like the LangGraph tables; packages/db/src/audit.ts is
-- the only code that touches it. Months are UTC.
CREATE SCHEMA IF NOT EXISTS audit;
--> statement-breakpoint
CREATE TABLE audit.events (
  id uuid NOT NULL DEFAULT uuidv7(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  actor_id uuid,
  organization_id uuid,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- A partitioned table's primary key must include the partition key.
  PRIMARY KEY (occurred_at, id)
) PARTITION BY RANGE (occurred_at);
--> statement-breakpoint
-- Catches rows for a month whose partition doesn't exist yet; ensure_partition moves them out.
CREATE TABLE audit.events_default PARTITION OF audit.events DEFAULT;

--> statement-breakpoint
-- Organization activity pages and a person's own history, newest first (keyset on occurred_at, id).
CREATE INDEX events_organization_idx ON audit.events (organization_id, occurred_at DESC, id DESC)
  WHERE organization_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX events_actor_idx ON audit.events (actor_id, occurred_at DESC, id DESC)
  WHERE actor_id IS NOT NULL;
--> statement-breakpoint
-- Rows can't be changed or deleted. The flag is set (transaction-local) only by ensure_partition,
-- which moves rows from the default partition into a new month. This guards against mistakes in
-- app code, not against a role that means to bypass it: any session can set the flag, and the
-- owning role can drop triggers or partitions. For a tamper-evident trail, run the app as a role
-- with only INSERT and SELECT here and ship events to an external store (compliance.md).
CREATE FUNCTION audit.reject_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('audit.maintenance', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit.events is append-only' USING ERRCODE = 'insufficient_privilege';
END
$$;
--> statement-breakpoint
CREATE TRIGGER events_append_only BEFORE UPDATE OR DELETE ON audit.events
  FOR EACH ROW EXECUTE FUNCTION audit.reject_change();
--> statement-breakpoint
CREATE TRIGGER events_no_truncate BEFORE TRUNCATE ON audit.events
  FOR EACH STATEMENT EXECUTE FUNCTION audit.reject_change();
--> statement-breakpoint
-- Statement-level triggers aren't inherited, so every partition gets its own TRUNCATE guard.
CREATE TRIGGER events_no_truncate BEFORE TRUNCATE ON audit.events_default
  FOR EACH STATEMENT EXECUTE FUNCTION audit.reject_change();
--> statement-breakpoint
-- Creates the partition for the UTC month containing `month`, moving any rows the default
-- partition caught for that range. Returns false when it already exists. Safe to run twice.
CREATE FUNCTION audit.ensure_partition(month date) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  from_ts timestamptz := make_timestamptz(extract(year FROM month)::int, extract(month FROM month)::int, 1, 0, 0, 0, 'UTC');
  to_ts timestamptz := make_timestamptz(extract(year FROM month + interval '1 month')::int, extract(month FROM month + interval '1 month')::int, 1, 0, 0, 0, 'UTC');
  partition text := format('events_%s', to_char(month, 'YYYY_MM'));
BEGIN
  IF to_regclass(format('audit.%I', partition)) IS NOT NULL THEN
    RETURN false;
  END IF;
  EXECUTE format('CREATE TABLE audit.%I (LIKE audit.events INCLUDING DEFAULTS)', partition);
  EXECUTE format('CREATE TRIGGER events_no_truncate BEFORE TRUNCATE ON audit.%I
    FOR EACH STATEMENT EXECUTE FUNCTION audit.reject_change()', partition);
  -- Inserts into the default partition between the move and ATTACH would make ATTACH fail, so
  -- hold it for the move; give up quickly rather than queue reads behind the lock.
  PERFORM set_config('lock_timeout', '5s', true);
  LOCK TABLE audit.events_default IN ACCESS EXCLUSIVE MODE;
  PERFORM set_config('audit.maintenance', 'on', true);
  EXECUTE format(
    'WITH moved AS (DELETE FROM audit.events_default WHERE occurred_at >= $1 AND occurred_at < $2 RETURNING *)
     INSERT INTO audit.%I SELECT * FROM moved', partition)
    USING from_ts, to_ts;
  PERFORM set_config('audit.maintenance', 'off', true);
  EXECUTE format('ALTER TABLE audit.events ATTACH PARTITION audit.%I FOR VALUES FROM (%L) TO (%L)',
    partition, from_ts, to_ts);
  RETURN true;
END
$$;
--> statement-breakpoint
-- Drops monthly partitions that end on or before `cutoff`. Returns how many were dropped.
CREATE FUNCTION audit.drop_partitions_before(cutoff timestamptz) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  child record;
  dropped integer := 0;
BEGIN
  FOR child IN
    SELECT c.relname
      FROM pg_inherits i
      JOIN pg_class c ON c.oid = i.inhrelid
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_namespace n ON n.oid = p.relnamespace
     WHERE n.nspname = 'audit' AND p.relname = 'events' AND c.relname ~ '^events_\d{4}_\d{2}$'
  LOOP
    IF make_timestamptz(substr(child.relname, 8, 4)::int, substr(child.relname, 13, 2)::int, 1, 0, 0, 0, 'UTC')
         + interval '1 month' <= cutoff THEN
      EXECUTE format('DROP TABLE audit.%I', child.relname);
      dropped := dropped + 1;
    END IF;
  END LOOP;
  RETURN dropped;
END
$$;
--> statement-breakpoint
-- This month and the next three; the daily maintenance job keeps creating them ahead.
SELECT audit.ensure_partition((date_trunc('month', now() AT TIME ZONE 'UTC') + make_interval(months => m))::date)
  FROM generate_series(0, 3) AS m;
