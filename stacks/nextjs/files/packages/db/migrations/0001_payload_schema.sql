-- Postgres schema for Payload CMS tables (apps/web PAYLOAD_DB_SCHEMA). Payload's adapter doesn't
-- create it, and its own migrations run after this package's, so the schema is ready for them.
CREATE SCHEMA IF NOT EXISTS payload;
