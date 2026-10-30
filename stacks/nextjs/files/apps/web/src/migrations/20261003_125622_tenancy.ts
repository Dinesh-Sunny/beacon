import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_tenants_status" AS ENUM('active', 'suspended');
  CREATE TABLE "payload"."users_tenants" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tenant_id" uuid NOT NULL
  );
  
  CREATE TABLE "payload"."tenants_domains" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"domain" varchar NOT NULL,
  	"primary" boolean DEFAULT false
  );
  
  CREATE TABLE "payload"."tenants" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"status" "payload"."enum_tenants_status" DEFAULT 'active' NOT NULL,
  	"organization_id" varchar,
  	"identity_site_name" varchar,
  	"identity_description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  DROP INDEX "payload"."pages_slug_idx";
  -- Hand-added: the navigation global becomes a per-tenant collection in the same table. Its
  -- one row keeps its links; fill any missing timestamps before they become required.
  UPDATE "payload"."navigation" SET "updated_at" = coalesce("updated_at", now()), "created_at" = coalesce("created_at", now());
  ALTER TABLE "payload"."navigation" ALTER COLUMN "updated_at" SET DEFAULT now();
  ALTER TABLE "payload"."navigation" ALTER COLUMN "updated_at" SET NOT NULL;
  ALTER TABLE "payload"."navigation" ALTER COLUMN "created_at" SET DEFAULT now();
  ALTER TABLE "payload"."navigation" ALTER COLUMN "created_at" SET NOT NULL;
  ALTER TABLE "payload"."media" ADD COLUMN "tenant_id" uuid;
  ALTER TABLE "payload"."pages" ADD COLUMN "tenant_id" uuid;
  ALTER TABLE "payload"."_pages_v" ADD COLUMN "version_tenant_id" uuid;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "tenants_id" uuid;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "navigation_id" uuid;
  ALTER TABLE "payload"."navigation" ADD COLUMN "tenant_id" uuid;
  ALTER TABLE "payload"."users_tenants" ADD CONSTRAINT "users_tenants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "payload"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."users_tenants" ADD CONSTRAINT "users_tenants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."tenants_domains" ADD CONSTRAINT "tenants_domains_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_tenants_order_idx" ON "payload"."users_tenants" USING btree ("_order");
  CREATE INDEX "users_tenants_parent_id_idx" ON "payload"."users_tenants" USING btree ("_parent_id");
  CREATE INDEX "users_tenants_tenant_idx" ON "payload"."users_tenants" USING btree ("tenant_id");
  CREATE INDEX "tenants_domains_order_idx" ON "payload"."tenants_domains" USING btree ("_order");
  CREATE INDEX "tenants_domains_parent_id_idx" ON "payload"."tenants_domains" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "tenants_domains_domain_idx" ON "payload"."tenants_domains" USING btree ("domain");
  CREATE UNIQUE INDEX "tenants_slug_idx" ON "payload"."tenants" USING btree ("slug");
  CREATE UNIQUE INDEX "tenants_organization_id_idx" ON "payload"."tenants" USING btree ("organization_id");
  CREATE INDEX "tenants_updated_at_idx" ON "payload"."tenants" USING btree ("updated_at");
  CREATE INDEX "tenants_created_at_idx" ON "payload"."tenants" USING btree ("created_at");
  ALTER TABLE "payload"."media" ADD CONSTRAINT "media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "payload"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."pages" ADD CONSTRAINT "pages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "payload"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_pages_v" ADD CONSTRAINT "_pages_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "payload"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenants_fk" FOREIGN KEY ("tenants_id") REFERENCES "payload"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_navigation_fk" FOREIGN KEY ("navigation_id") REFERENCES "payload"."navigation"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."navigation" ADD CONSTRAINT "navigation_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "payload"."tenants"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "media_tenant_idx" ON "payload"."media" USING btree ("tenant_id");
  CREATE INDEX "pages_tenant_idx" ON "payload"."pages" USING btree ("tenant_id");
  CREATE UNIQUE INDEX "tenant_slug_idx" ON "payload"."pages" USING btree ("tenant_id","slug");
  CREATE INDEX "_pages_v_version_version_tenant_idx" ON "payload"."_pages_v" USING btree ("version_tenant_id");
  CREATE INDEX "version_tenant_version_slug_idx" ON "payload"."_pages_v" USING btree ("version_tenant_id","version_slug");
  CREATE INDEX "payload_locked_documents_rels_tenants_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("tenants_id");
  CREATE INDEX "payload_locked_documents_rels_navigation_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("navigation_id");
  CREATE UNIQUE INDEX "navigation_tenant_idx" ON "payload"."navigation" USING btree ("tenant_id");
  CREATE INDEX "navigation_updated_at_idx" ON "payload"."navigation" USING btree ("updated_at");
  CREATE INDEX "navigation_created_at_idx" ON "payload"."navigation" USING btree ("created_at");
  CREATE INDEX "pages_slug_idx" ON "payload"."pages" USING btree ("slug");
  -- Hand-added (docs/adr/0002-multi-tenancy.md): seed the default tenant, which answers every
  -- host that isn't a tenant domain, and give it all existing content.
  INSERT INTO "payload"."tenants" ("name", "slug", "status") VALUES ('Default site', 'default', 'active')
    ON CONFLICT ("slug") DO NOTHING;
  UPDATE "payload"."pages" SET "tenant_id" = (SELECT "id" FROM "payload"."tenants" WHERE "slug" = 'default') WHERE "tenant_id" IS NULL;
  UPDATE "payload"."_pages_v" SET "version_tenant_id" = (SELECT "id" FROM "payload"."tenants" WHERE "slug" = 'default') WHERE "version_tenant_id" IS NULL;
  UPDATE "payload"."media" SET "tenant_id" = (SELECT "id" FROM "payload"."tenants" WHERE "slug" = 'default') WHERE "tenant_id" IS NULL;
  UPDATE "payload"."navigation" SET "tenant_id" = (SELECT "id" FROM "payload"."tenants" WHERE "slug" = 'default') WHERE "tenant_id" IS NULL;
  -- Staff without a tenant see nothing under the plugin; existing editors keep their access to
  -- the default site. Admins see every tenant without a row.
  INSERT INTO "payload"."users_tenants" ("_order", "_parent_id", "id", "tenant_id")
    SELECT 1, u."id", gen_random_uuid()::varchar, (SELECT "id" FROM "payload"."tenants" WHERE "slug" = 'default')
      FROM "payload"."users" u
     WHERE u."role" IS DISTINCT FROM 'admin'
       AND NOT EXISTS (SELECT 1 FROM "payload"."users_tenants" ut WHERE ut."_parent_id" = u."id");`)
}

// Reversible only while there is a single tenant: page slugs must be unique again and the
// navigation collection must collapse back to one global row. Constraints go before the tables
// they point at (dropping a table with CASCADE already removes them).
export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload"."media" DROP CONSTRAINT IF EXISTS "media_tenant_id_tenants_id_fk";
  ALTER TABLE "payload"."pages" DROP CONSTRAINT IF EXISTS "pages_tenant_id_tenants_id_fk";
  ALTER TABLE "payload"."_pages_v" DROP CONSTRAINT IF EXISTS "_pages_v_version_tenant_id_tenants_id_fk";
  ALTER TABLE "payload"."navigation" DROP CONSTRAINT IF EXISTS "navigation_tenant_id_tenants_id_fk";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_tenants_fk";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_navigation_fk";
  ALTER TABLE "payload"."users_tenants" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."tenants_domains" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."tenants" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."users_tenants" CASCADE;
  DROP TABLE "payload"."tenants_domains" CASCADE;
  DROP TABLE "payload"."tenants" CASCADE;

  DROP INDEX "payload"."media_tenant_idx";
  DROP INDEX "payload"."pages_tenant_idx";
  DROP INDEX "payload"."tenant_slug_idx";
  DROP INDEX "payload"."_pages_v_version_version_tenant_idx";
  DROP INDEX "payload"."version_tenant_version_slug_idx";
  DROP INDEX "payload"."navigation_tenant_idx";
  DROP INDEX "payload"."navigation_updated_at_idx";
  DROP INDEX "payload"."navigation_created_at_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_tenants_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_navigation_id_idx";
  DROP INDEX "payload"."pages_slug_idx";
  ALTER TABLE "payload"."navigation" ALTER COLUMN "updated_at" DROP DEFAULT;
  ALTER TABLE "payload"."navigation" ALTER COLUMN "updated_at" DROP NOT NULL;
  ALTER TABLE "payload"."navigation" ALTER COLUMN "created_at" DROP DEFAULT;
  ALTER TABLE "payload"."navigation" ALTER COLUMN "created_at" DROP NOT NULL;
  CREATE UNIQUE INDEX "pages_slug_idx" ON "payload"."pages" USING btree ("slug");
  ALTER TABLE "payload"."media" DROP COLUMN "tenant_id";
  ALTER TABLE "payload"."pages" DROP COLUMN "tenant_id";
  ALTER TABLE "payload"."_pages_v" DROP COLUMN "version_tenant_id";
  ALTER TABLE "payload"."navigation" DROP COLUMN "tenant_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "tenants_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "navigation_id";
  DROP TYPE "payload"."enum_tenants_status";`)
}
