import { consumeWithFallback } from "@__NAME__/ratelimit";
import { headers } from "next/headers";
import {
  AGENT_RATE_LIMIT,
  isAgentName,
  MAX_AGENT_REQUEST_BYTES,
  VERCEL_OIDC_HEADER,
} from "@/lib/agents";
import { getAuth } from "@/lib/auth";
import { isBotRequest } from "@/lib/bot-protection";
import { pythonApiBaseUrl } from "@/lib/python-api";
import { getSession } from "@/lib/session";

const HTTP = {
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  tooLarge: 413,
  tooMany: 429,
  badGateway: 502,
  // Not sent to anyone: the visitor already left. Logs read it as "client closed request".
  clientClosed: 499,
} as const;

function refuse(status: number, message: string, init?: ResponseInit) {
  return Response.json({ message }, { ...init, status });
}

// Passes the body through while counting it, so a chunked request without a content-length
// can't make the sidecar (and the model) read more than the cap.
function cappedBody(
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  let total = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength;
        if (total > MAX_AGENT_REQUEST_BYTES) {
          controller.error(new RangeError("Agent request too large"));
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
}

// Browser → private Python sidecar for agents. The session stays here: the sidecar gets a
// 15-minute service token naming the user, nothing else, and only agent paths are reachable.
export async function forwardToAgent(
  request: Request,
  agent: string,
  sidecarPath: string,
): Promise<Response> {
  if (!isAgentName(agent)) return refuse(HTTP.notFound, "Unknown agent");
  const session = await getSession();
  if (!session) return refuse(HTTP.unauthorized, "Sign in first");
  // Runs spend model credits: the browser must pass Vercel BotID (lib/bot-protection.ts). After
  // the session check, so anonymous junk never costs a bot check.
  if (request.method === "POST" && (await isBotRequest())) {
    return refuse(HTTP.forbidden, "This request looked automated");
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_AGENT_REQUEST_BYTES) {
    return refuse(HTTP.tooLarge, "Request too large");
  }
  const limit = await consumeWithFallback(
    "agents",
    session.user.id,
    AGENT_RATE_LIMIT,
  );
  if (!limit.allowed) {
    return refuse(HTTP.tooMany, "Too many requests", {
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }
  const incoming = await headers();
  const { token } = await getAuth().api.getToken({ headers: incoming });
  const oidcToken = incoming.get(VERCEL_OIDC_HEADER);
  const body =
    request.method !== "GET" && request.body
      ? cappedBody(request.body)
      : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(new URL(sidecarPath, pythonApiBaseUrl()), {
      method: request.method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: request.headers.get("accept") ?? "application/json",
        ...(oidcToken && { [VERCEL_OIDC_HEADER]: oidcToken }),
      },
      // Streams the request body through instead of buffering it.
      ...(body && { body, duplex: "half" }),
      signal: request.signal,
      cache: "no-store",
    } as RequestInit);
  } catch (error) {
    // The visitor left (aborted) or the body went over the cap: nothing to report.
    if (request.signal.aborted)
      return new Response(null, { status: HTTP.clientClosed });
    if (
      error instanceof RangeError ||
      error?.constructor?.name === "RangeError"
    ) {
      return refuse(HTTP.tooLarge, "Request too large");
    }
    console.error("[agents] sidecar unreachable", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return refuse(HTTP.badGateway, "The assistant is unavailable right now");
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  });
}
