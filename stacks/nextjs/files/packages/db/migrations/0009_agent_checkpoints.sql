-- LangGraph's Postgres checkpointer tables (langgraph-checkpoint-postgres 3.1.2, migrations 0-9),
-- created here so `pnpm db:migrate` owns every table and the app never runs DDL at runtime.
-- The rows in checkpoint_migrations tell LangGraph's setup() these steps are done. When upgrading
-- langgraph-checkpoint-postgres, compare BasePostgresSaver.MIGRATIONS and add a migration for any
-- new step. Unqualified names on purpose: LangGraph's queries don't schema-qualify, so the tables
-- live in `public` (the pooler can't set a per-connection search_path).
CREATE TABLE IF NOT EXISTS "checkpoint_migrations" (
	"v" integer PRIMARY KEY
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checkpoints" (
	"thread_id" text NOT NULL,
	"checkpoint_ns" text NOT NULL DEFAULT '',
	"checkpoint_id" text NOT NULL,
	"parent_checkpoint_id" text,
	"type" text,
	"checkpoint" jsonb NOT NULL,
	"metadata" jsonb NOT NULL DEFAULT '{}',
	PRIMARY KEY ("thread_id", "checkpoint_ns", "checkpoint_id")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checkpoint_blobs" (
	"thread_id" text NOT NULL,
	"checkpoint_ns" text NOT NULL DEFAULT '',
	"channel" text NOT NULL,
	"version" text NOT NULL,
	"type" text NOT NULL,
	"blob" bytea,
	PRIMARY KEY ("thread_id", "checkpoint_ns", "channel", "version")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checkpoint_writes" (
	"thread_id" text NOT NULL,
	"checkpoint_ns" text NOT NULL DEFAULT '',
	"checkpoint_id" text NOT NULL,
	"task_id" text NOT NULL,
	"idx" integer NOT NULL,
	"channel" text NOT NULL,
	"type" text,
	"blob" bytea NOT NULL,
	"task_path" text NOT NULL DEFAULT '',
	PRIMARY KEY ("thread_id", "checkpoint_ns", "checkpoint_id", "task_id", "idx")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkpoints_thread_id_idx" ON "checkpoints" ("thread_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkpoint_blobs_thread_id_idx" ON "checkpoint_blobs" ("thread_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkpoint_writes_thread_id_idx" ON "checkpoint_writes" ("thread_id");--> statement-breakpoint
INSERT INTO "checkpoint_migrations" ("v") SELECT generate_series(0, 9) ON CONFLICT DO NOTHING;
