import { getDb, recordAuditEvent } from "@__NAME__/db";
import { consumeWithFallback } from "@__NAME__/ratelimit";
import { headers } from "next/headers";
import {
  isAgentName,
  SIDECAR_AGENT_PATH,
  VERCEL_OIDC_HEADER,
} from "@/lib/agents";
import { getAuth } from "@/lib/auth";
import { isBotRequest } from "@/lib/bot-protection";
import { pythonApiBaseUrl } from "@/lib/python-api";
import { SITE } from "@/lib/site";
import {
  EXPORT_FRESH_SESSION_MS,
  EXPORT_MESSAGE_THREAD_LIMIT,
  EXPORT_RATE_LIMIT,
  EXPORT_RATE_LIMIT_SCOPE,
} from "./config";
import { buildDataExport, type DataExport } from "./export-data";

const HTTP_STATUS = {
  unauthorized: 401,
  forbidden: 403,
  tooManyRequests: 429,
} as const;
// `YYYY-MM-DD` from an ISO timestamp, for the file name.
const DATE_LENGTH = 10;
// Indented so the file is readable when opened.
const JSON_INDENT = 2;
// A slow sidecar must not stall the download; conversations it doesn't return are flagged.
const SIDECAR_TIMEOUT_MS = 10_000;

type ConversationMessages = {
  threadId: string;
  messages: unknown[] | null;
};

function refuse(status: number, message: string, init?: ResponseInit) {
  return Response.json({ message }, { ...init, status });
}

// The person's messages in each conversation, from LangGraph state through the sidecar (the
// same endpoint the assistant uses to reopen a thread). Null where the sidecar couldn't answer.
async function conversationMessages(
  data: DataExport,
  requestHeaders: Headers,
): Promise<ConversationMessages[]> {
  const threads = data.assistantConversations.rows
    .slice(0, EXPORT_MESSAGE_THREAD_LIMIT)
    .flatMap((row) =>
      typeof row.id === "string" &&
      typeof row.agent === "string" &&
      isAgentName(row.agent)
        ? [{ id: row.id, agent: row.agent }]
        : [],
    );
  if (threads.length === 0) return [];
  const { token } = await getAuth().api.getToken({ headers: requestHeaders });
  const oidcToken = requestHeaders.get(VERCEL_OIDC_HEADER);
  const signal = AbortSignal.timeout(SIDECAR_TIMEOUT_MS);
  return Promise.all(
    threads.map(async (thread) => {
      try {
        const response = await fetch(
          new URL(
            `${SIDECAR_AGENT_PATH}/${thread.agent}/threads/${encodeURIComponent(thread.id)}/messages`,
            pythonApiBaseUrl(),
          ),
          {
            headers: {
              authorization: `Bearer ${token}`,
              ...(oidcToken && { [VERCEL_OIDC_HEADER]: oidcToken }),
            },
            cache: "no-store",
            signal,
          },
        );
        if (!response.ok) return { threadId: thread.id, messages: null };
        const body = (await response.json()) as { messages?: unknown[] };
        return { threadId: thread.id, messages: body.messages ?? [] };
      } catch {
        // Recorded in the file as unavailable (messages: null); the rest of the export stands.
        return { threadId: thread.id, messages: null };
      }
    }),
  );
}

// "Download your data": same-origin only, a recent sign-in read without the cookie cache, rate
// limited, and recorded in the audit log.
export async function dataExportResponse(request: Request): Promise<Response> {
  // A cross-site link can't read the file, but it could use up the person's downloads.
  if (request.headers.get("sec-fetch-site") !== "same-origin") {
    return refuse(
      HTTP_STATUS.forbidden,
      "Start the download from your account.",
    );
  }
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true },
  });
  if (!session) {
    return refuse(HTTP_STATUS.unauthorized, "Sign in to download your data.");
  }
  if (await isBotRequest()) {
    return refuse(HTTP_STATUS.forbidden, "This request looked automated.");
  }
  const signedInAt = new Date(session.session.createdAt).getTime();
  if (Date.now() - signedInAt > EXPORT_FRESH_SESSION_MS) {
    return refuse(
      HTTP_STATUS.forbidden,
      "Sign in again to download your data.",
    );
  }
  const userId = session.user.id;
  const limit = await consumeWithFallback(
    EXPORT_RATE_LIMIT_SCOPE,
    userId,
    EXPORT_RATE_LIMIT,
  );
  if (!limit.allowed) {
    return refuse(
      HTTP_STATUS.tooManyRequests,
      "Too many downloads. Try again later.",
      { headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const data = await buildDataExport(userId, SITE.name);
  const messages = await conversationMessages(data, requestHeaders);
  await recordAuditEvent(getDb().$client, {
    action: "user.data_exported",
    actorId: userId,
  });
  const date = data.format.exportedAt.slice(0, DATE_LENGTH);
  const fileName = `${SITE.name}-data-${date}.json`;
  return new Response(
    JSON.stringify({ ...data, assistantMessages: messages }, null, JSON_INDENT),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // RFC 6266: an ASCII fallback plus the exact name, so any site name stays a valid header.
        "Content-Disposition": `attachment; filename="data-${date}.json"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
