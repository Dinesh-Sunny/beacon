import { clientKey, consumeWithFallback } from "@__NAME__/ratelimit";
import { CLIENT_IP_HEADER, CONSENT_RATE_LIMITS } from "./config.ts";

const TOO_MANY_REQUESTS = 429;

// Per-IP limit on the public consent API, before the guard reads any body. Saves and reads count
// separately so browsing can't use up the allowance for recording a choice. Null means proceed.
export async function limitConsentRequest(
  request: Request,
): Promise<Response | null> {
  const client = clientKey(request.headers.get(CLIENT_IP_HEADER));
  const kind = request.method === "POST" ? "save" : "read";
  const { allowed, retryAfterSeconds } = await consumeWithFallback(
    `consent-${kind}`,
    client,
    CONSENT_RATE_LIMITS[kind],
  );
  if (allowed) return null;
  return Response.json(
    { message: "Too many requests" },
    {
      status: TOO_MANY_REQUESTS,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}
