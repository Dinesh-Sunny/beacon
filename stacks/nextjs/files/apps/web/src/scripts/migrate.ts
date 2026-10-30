// One migration entry point for the app: Drizzle tables (@__NAME__/db) then Payload, both under
// one advisory lock so concurrent deploys can't interleave. Runs through `payload run`, which
// loads .env files and resolves `@payload-config`.
//   pnpm db:migrate                       always migrates (local, CI)
//   pnpm --filter web migrate:deploy      Vercel build: only when DB_MIGRATE_ON_BUILD=1
import { directUrl } from "@__NAME__/db";
import { MIGRATE_ON_BUILD_ENV } from "@__NAME__/db/config";
import {
  isBuildMigrationEnabled,
  migrateDrizzle,
  withMigrationLock,
} from "@__NAME__/db/migrate";
import { getPayload } from "payload";

const DEPLOY_MODE = "deploy";

if (process.argv[2] === DEPLOY_MODE && !isBuildMigrationEnabled()) {
  console.log(`[db] ${MIGRATE_ON_BUILD_ENV} is not "1"; skipping migrations`);
} else {
  // Must be set before the config loads: it switches Payload to the direct URL.
  process.env.PAYLOAD_MIGRATING = "true";
  const { default: config } = await import("@payload-config");

  await withMigrationLock(directUrl(), async (client) => {
    await migrateDrizzle(client);
    const payload = await getPayload({ config });
    try {
      await payload.db.migrate();
    } finally {
      await payload.destroy();
    }
  });
  console.log("[db] migrations applied");
}
