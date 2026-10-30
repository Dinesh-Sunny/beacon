import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "payload"."enum_payload_jobs_log_task_slug" ADD VALUE 'cancel-subscriptions' BEFORE 'schedulePublish';
  ALTER TYPE "payload"."enum_payload_jobs_log_task_slug" ADD VALUE 'send-auth-email' BEFORE 'schedulePublish';
  ALTER TYPE "payload"."enum_payload_jobs_log_task_slug" ADD VALUE 'auth-cleanup' BEFORE 'schedulePublish';
  ALTER TYPE "payload"."enum_payload_jobs_log_task_slug" ADD VALUE 'consent-retention' BEFORE 'schedulePublish';
  ALTER TYPE "payload"."enum_payload_jobs_log_task_slug" ADD VALUE 'jobs-cleanup' BEFORE 'schedulePublish';
  ALTER TYPE "payload"."enum_payload_jobs_task_slug" ADD VALUE 'cancel-subscriptions' BEFORE 'schedulePublish';
  ALTER TYPE "payload"."enum_payload_jobs_task_slug" ADD VALUE 'send-auth-email' BEFORE 'schedulePublish';
  ALTER TYPE "payload"."enum_payload_jobs_task_slug" ADD VALUE 'auth-cleanup' BEFORE 'schedulePublish';
  ALTER TYPE "payload"."enum_payload_jobs_task_slug" ADD VALUE 'consent-retention' BEFORE 'schedulePublish';
  ALTER TYPE "payload"."enum_payload_jobs_task_slug" ADD VALUE 'jobs-cleanup' BEFORE 'schedulePublish';
  CREATE TABLE "payload"."payload_jobs_stats" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"stats" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload"."payload_jobs" ADD COLUMN "meta" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."payload_jobs_stats" CASCADE;
  ALTER TABLE "payload"."payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "payload"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "payload"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'schedulePublish');
  ALTER TABLE "payload"."payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "payload"."enum_payload_jobs_log_task_slug" USING "task_slug"::"payload"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload"."payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "payload"."enum_payload_jobs_task_slug";
  CREATE TYPE "payload"."enum_payload_jobs_task_slug" AS ENUM('inline', 'schedulePublish');
  ALTER TABLE "payload"."payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "payload"."enum_payload_jobs_task_slug" USING "task_slug"::"payload"."enum_payload_jobs_task_slug";
  ALTER TABLE "payload"."payload_jobs" DROP COLUMN "meta";`)
}
