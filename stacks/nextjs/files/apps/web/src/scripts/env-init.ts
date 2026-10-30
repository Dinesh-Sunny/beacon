// Creates apps/web/.env.local from .env.example on first setup, filling the secrets the app can't
// boot without (Payload refuses to start, Better Auth encrypts JWT keys with its secret) with
// fresh random values. Third-party keys stay empty until a project needs them. Never overwrites
// an existing file: Better Auth's JWT keys in the local database are tied to the secret in it.
//   pnpm env:init   (also run by `pnpm setup` and `pnpm dev:py`)
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const APP_DIR = resolve(import.meta.dirname, "../..");
const EXAMPLE = resolve(APP_DIR, ".env.example");
const TARGET = resolve(APP_DIR, ".env.local");
const GENERATED_SECRETS = [
  "PAYLOAD_SECRET",
  "BETTER_AUTH_SECRET",
  "CRON_SECRET",
] as const;
const SECRET_BYTES = 32;
const OWNER_READ_WRITE = 0o600;
// Fails instead of overwriting, so two concurrent runs can't both write the file.
const CREATE_ONLY = "wx";

function emptyLine(name: string): RegExp {
  return new RegExp(`^${name}=$`, "m");
}

// Throws when the example no longer has an empty `NAME=` line, so setup can't report success
// while leaving a required secret unset.
function fillSecret(env: string, name: string): string {
  if (!emptyLine(name).test(env)) {
    throw new Error(`env:init: no empty ${name}= line in .env.example`);
  }
  const value = randomBytes(SECRET_BYTES).toString("hex");
  return env.replace(emptyLine(name), `${name}=${value}`);
}

// Files made before env:init generated secrets may still have them empty: point that out
// without touching the file.
function warnEmptySecrets(): void {
  const env = readFileSync(TARGET, "utf8");
  const empty = GENERATED_SECRETS.filter((name) => emptyLine(name).test(env));
  if (empty.length === 0) return;
  console.warn(
    `env:init: ${empty.join(", ")} empty in apps/web/.env.local; set each to \`openssl rand -hex 32\``,
  );
}

const env = GENERATED_SECRETS.reduce(fillSecret, readFileSync(EXAMPLE, "utf8"));
try {
  writeFileSync(TARGET, env, { flag: CREATE_ONLY, mode: OWNER_READ_WRITE });
  console.log(
    `env:init: created apps/web/.env.local with local ${GENERATED_SECRETS.join(", ")}`,
  );
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  console.log("env:init: apps/web/.env.local exists, leaving it as is");
  warnEmptySecrets();
}
