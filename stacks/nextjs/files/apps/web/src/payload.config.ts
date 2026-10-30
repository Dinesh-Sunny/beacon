import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeConnectionString, registerPool } from "@__NAME__/db";
import {
  APPLICATION_NAME,
  DATABASE_URL_ENV,
  DATABASE_URL_UNPOOLED_ENV,
  MIGRATION_DDL_OPTIONS,
  POOL_CONFIG,
} from "@__NAME__/db/config";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";
import sharp from "sharp";
import { SITE } from "@/lib/site";
import { canRunJobs } from "@/payload/access";
import { PAGE_BLOCKS } from "@/payload/blocks";
import { Customers } from "@/payload/collections/Customers";
import { Media } from "@/payload/collections/Media";
import { Navigation } from "@/payload/collections/Navigation";
import { Pages } from "@/payload/collections/Pages";
import { Tenants } from "@/payload/collections/Tenants";
import { Users } from "@/payload/collections/Users";
import { commercePlugin } from "@/payload/commerce/plugin";
import {
  PAYLOAD_ADMIN_ROUTE,
  PAYLOAD_DB_SCHEMA,
  PAYLOAD_POOL_MAX,
} from "@/payload/constants";
import { payloadEmailAdapter } from "@/payload/email";
import { JOB_TASK_CONFIGS } from "@/payload/jobs/tasks";
import { storagePlugin } from "@/payload/storage";
import { tenancyPlugin } from "@/payload/tenancy";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Our migrate script (`pnpm db:migrate`) sets PAYLOAD_MIGRATING before this config loads: migrations
// need the direct URL and migration session settings, app traffic goes through the pooler. Payload's
// own CLI sets it only after importing the config, so run `payload migrate:*` commands with
// PAYLOAD_MIGRATING=true in the environment (docs/knowledge/database.md). A missing URL is allowed
// here so `next build` works without a database; Payload only connects on first use.
const isMigrating = process.env.PAYLOAD_MIGRATING === "true";

function connectionString(): string | undefined {
  const value =
    process.env[isMigrating ? DATABASE_URL_UNPOOLED_ENV : DATABASE_URL_ENV];
  return value ? normalizeConnectionString(value) : undefined;
}

// Startup options are only allowed on the direct URL; the pooler rejects them. Migrations lift the
// app role's timeouts and cap lock waits (packages/db/src/config.ts).
const sessionSettings = isMigrating
  ? {
      application_name: APPLICATION_NAME.migrate,
      options: MIGRATION_DDL_OPTIONS,
    }
  : { application_name: APPLICATION_NAME.payload };

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: dirname },
    meta: { titleSuffix: ` · ${SITE.name}` },
  },
  routes: { admin: PAYLOAD_ADMIN_ROUTE },
  collections: [Users, Tenants, Media, Pages, Navigation, Customers],
  blocks: PAGE_BLOCKS,
  editor: lexicalEditor(),
  email: payloadEmailAdapter,
  secret: process.env.PAYLOAD_SECRET ?? "",
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  db: postgresAdapter({
    pool: {
      ...POOL_CONFIG,
      max: PAYLOAD_POOL_MAX,
      connectionString: connectionString(),
      ...sessionSettings,
    },
    schemaName: PAYLOAD_DB_SCHEMA,
    // Schema changes go through committed migrations everywhere (`pnpm cms:migrate:create`);
    // dev push would bypass them and stall `payload migrate` with a prompt.
    push: false,
    // Databases are provisioned per environment (Docker, Neon, PlanetScale), never by Payload.
    disableCreateDatabase: true,
    migrationDir: path.resolve(dirname, "migrations"),
    idType: "uuid",
  }),
  // Jobs (scheduled publish, payload/jobs/tasks.ts) run only through the Next route
  // `/api/payload-jobs/run`, which Vercel Cron calls (vercel.json) for every queue; the same call
  // queues scheduled tasks. Never `autoRun` on serverless, and never the `payload jobs:run` CLI:
  // hooks call revalidateTag, which needs a Next request. Payload 3 can hand one job to two
  // overlapping runners, so keep a single cron and make every task safe to run twice.
  jobs: {
    access: { run: canRunJobs },
    tasks: JOB_TASK_CONFIGS,
    deleteJobOnComplete: true,
  },
  onInit: (payload) => {
    registerPool(payload.db.pool);
  },
  sharp,
  // The tenancy plugin scopes collections other plugins add, so it runs last.
  plugins: [storagePlugin, commercePlugin, tenancyPlugin],
  graphQL: { disablePlaygroundInProduction: true },
});
