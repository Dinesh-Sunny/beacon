import { defineConfig } from "drizzle-kit";
import { DATABASE_URL_UNPOOLED_ENV, MIGRATIONS_DIR } from "./src/config.ts";
import { normalizeConnectionString } from "./src/env.ts";

// `generate` works offline; `studio`, `check`, and `pull` need the direct URL.
const directUrl = process.env[DATABASE_URL_UNPOOLED_ENV];

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: `./${MIGRATIONS_DIR}`,
  casing: "snake_case",
  strict: true,
  verbose: true,
  dbCredentials: {
    url: directUrl ? normalizeConnectionString(directUrl) : "",
  },
});
