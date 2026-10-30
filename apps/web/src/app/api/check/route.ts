import { type CheckEvent, SituationSchema } from "@beacon/rules";
import { runCheck } from "@/lib/check-client";
import { env } from "@/lib/env";
import { clientIp, takeCheckSlot } from "@/lib/rate-limit";

// Streams the check as newline-delimited JSON (packages/rules/src/events.ts). Nothing is stored.
export async function POST(request: Request) {
  const limit = takeCheckSlot(
    clientIp(request.headers),
    env.BEACON_PER_IP_PER_MINUTE,
    env.BEACON_DAILY_CAP,
  );
  if (!limit.ok) {
    const message =
      limit.reason === "daily"
        ? "Lots of people are checking today. Please try again tomorrow, or see the example."
        : "Lots of people are checking right now. Try again in about 2 minutes.";
    return Response.json(
      { message },
      {
        status: 429,
        headers: { "retry-after": limit.reason === "daily" ? "3600" : "60" },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { message: "We could not read your answers. Please try again." },
      { status: 400 },
    );
  }
  const parsed = SituationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        message:
          "Some answers did not look right. Please check them and try again.",
      },
      { status: 400 },
    );
  }

  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const encoder = new TextEncoder();
  const events = runCheck(parsed.data, { signal: abort.signal });
  const line = (e: CheckEvent) => encoder.encode(`${JSON.stringify(e)}\n`);

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await events.next();
        if (done || abort.signal.aborted) {
          controller.close();
          return;
        }
        controller.enqueue(line(value));
      } catch {
        if (!abort.signal.aborted) {
          controller.enqueue(
            line({
              type: "error",
              message: "That took longer than usual. Your answers are safe.",
            }),
          );
        }
        controller.close();
      }
    },
    async cancel() {
      abort.abort();
      await events.return(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
