import { DATABASE_URL_ENV, DATABASE_URL_UNPOOLED_ENV } from "./config.ts";

type Env = Readonly<Record<string, string | undefined>>;

export class DatabaseConfigError extends Error {
  override name = "DatabaseConfigError";
}

// PlanetScale connection strings carry `sslrootcert=system` (libpq: use the OS trust store).
// node-pg reads it as a file path and fails; Node's default CAs already verify the server.
const UNSUPPORTED_PARAMS = new Map([["sslrootcert", "system"]]);

export function normalizeConnectionString(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new DatabaseConfigError("Database URL is not a valid URL");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new DatabaseConfigError(
      `Database URL must use postgres:// or postgresql://, got ${url.protocol}`,
    );
  }
  for (const [param, value] of UNSUPPORTED_PARAMS) {
    if (url.searchParams.get(param) === value) url.searchParams.delete(param);
  }
  return url.toString();
}

function readUrl(env: Env, name: string): string {
  const value = env[name];
  if (!value) {
    throw new DatabaseConfigError(
      `${name} is not set. See docs/knowledge/database.md`,
    );
  }
  return normalizeConnectionString(value);
}

// Pooled endpoint for app traffic.
export function pooledUrl(env: Env = process.env): string {
  return readUrl(env, DATABASE_URL_ENV);
}

// Direct endpoint for migrations and anything that needs a real session.
export function directUrl(env: Env = process.env): string {
  return readUrl(env, DATABASE_URL_UNPOOLED_ENV);
}
