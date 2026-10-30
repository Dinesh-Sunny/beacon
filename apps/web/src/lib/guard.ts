import "server-only";
import { env } from "./env";
import {
  BodyTooLargeError,
  BUSY_MESSAGE,
  clientIp,
  type Route,
  readJson,
  takeSlot,
} from "./rate-limit";

// Tracing would otherwise record every prompt: answers, letters and replies.
if (
  env.LANGSMITH_TRACING === "true" &&
  (env.LANGSMITH_HIDE_INPUTS !== "true" ||
    env.LANGSMITH_HIDE_OUTPUTS !== "true")
)
  throw new Error(
    "LANGSMITH_TRACING needs LANGSMITH_HIDE_INPUTS=true and LANGSMITH_HIDE_OUTPUTS=true",
  );

/** Max request body per route, in bytes. A situation, a finding or a pasted letter fits well inside. */
export const MAX_BODY: Record<Route, number> = {
  check: 16_384,
  explain: 16_384,
  letter: 24_576,
  mcp: 32_768,
};

/** Reads the body under the route's size cap. Returns a 413 Response when it is too big. */
export async function readBody(
  request: Request,
  route: Route,
): Promise<{ body: unknown } | Response> {
  try {
    return { body: await readJson(request, MAX_BODY[route]) };
  } catch (error) {
    if (error instanceof BodyTooLargeError)
      return Response.json(
        { message: "That was too long for Beacon to read." },
        { status: 413 },
      );
    throw error;
  }
}

/** Takes a slot after validation. Returns a 429 Response when a limit is reached. */
export function limit(
  request: Request,
  route: Route,
  weight = 1,
): Response | null {
  const result = takeSlot(
    route,
    clientIp(request.headers),
    {
      perMinute: env.BEACON_PER_IP_PER_MINUTE,
      dailyRequests: env.BEACON_DAILY_CAP,
      dailyTokens: env.BEACON_DAILY_TOKENS,
    },
    weight,
  );
  if (result.ok) return null;
  return Response.json(
    { message: BUSY_MESSAGE[result.reason] },
    {
      status: 429,
      headers: { "retry-after": result.reason === "ip" ? "60" : "3600" },
    },
  );
}

/** Logs only what helps debugging, never text that may echo someone's answers or letter. */
export function logFailure(where: string, error: unknown): void {
  const e = error as { name?: string; status?: number };
  console.error(
    `[${where}] ${e?.name ?? "Error"}${e?.status ? ` ${e.status}` : ""}`,
  );
}
