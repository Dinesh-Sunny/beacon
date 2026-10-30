-- Server-side timeouts for the role that runs migrations (the app role on Neon, PlanetScale, and
-- local), in this database only. Role defaults are the one place that works through both poolers
-- (PgBouncer refuses timeout startup parameters) without a superuser: an ordinary role may set its
-- own. They apply at login, so pooled server connections pick them up as they are recycled.
-- Values mirror ROLE_TIMEOUTS in packages/db/src/config.ts; db.test.ts checks they match.
-- lock_timeout must stay below statement_timeout, and idle_in_transaction_session_timeout below
-- transaction_timeout; otherwise the first of each pair never fires (Postgres docs,
-- runtime-config-client).
DO $$
BEGIN
  EXECUTE format('ALTER ROLE CURRENT_USER IN DATABASE %I SET statement_timeout = %L', current_database(), '15s');
  EXECUTE format('ALTER ROLE CURRENT_USER IN DATABASE %I SET lock_timeout = %L', current_database(), '5s');
  EXECUTE format('ALTER ROLE CURRENT_USER IN DATABASE %I SET idle_in_transaction_session_timeout = %L', current_database(), '30s');
  EXECUTE format('ALTER ROLE CURRENT_USER IN DATABASE %I SET transaction_timeout = %L', current_database(), '1min');
END
$$;
