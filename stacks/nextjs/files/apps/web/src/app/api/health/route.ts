import { checkDatabase } from "@__NAME__/db";
import { isEmailConfigured } from "@__NAME__/email";
import { connection } from "next/server";

type EmailStatus = "ok" | "unconfigured" | "dev";

// Production without SES can't verify sign-ups or send resets, so it counts as degraded.
// Elsewhere the dev transport (server log) is expected.
function emailStatus(): EmailStatus {
  if (isEmailConfigured()) return "ok";
  return process.env.NODE_ENV === "production" ? "unconfigured" : "dev";
}

// Readiness probe for uptime monitors and deploy checks. Reports only up/down: the failure
// reason can name hosts, so it goes to server logs, not the response.
export async function GET(): Promise<Response> {
  // Must run per request: a prerendered result would report the build machine's database.
  await connection();
  const database = await checkDatabase();
  if (!database.ok) {
    console.error("[health] database check failed:", database.error);
  }
  const email = emailStatus();
  const healthy = database.ok && email !== "unconfigured";
  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      db: database.ok ? "ok" : "down",
      email,
    },
    {
      status: healthy ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
