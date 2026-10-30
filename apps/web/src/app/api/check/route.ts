import { type CheckEvent, SituationSchema } from "@beacon/rules";
import { runCheck } from "@/lib/check-client";
import { limit, logFailure, readBody } from "@/lib/guard";
import { recordTokens } from "@/lib/rate-limit";

// Streams the check as newline-delimited JSON (packages/rules/src/events.ts). Nothing is stored.
export async function POST(request: Request) {
  const read = await readBody(request, "check");
  if (read instanceof Response) return read;
  const parsed = SituationSchema.safeParse(read.body);
  if (!parsed.success)
    return Response.json(
      {
        message:
          "Some answers did not look right. Please check them and try again.",
      },
      { status: 400 },
    );
  const busy = limit(request, "check");
  if (busy) return busy;

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
        if (value.type === "usage")
          recordTokens(value.inputTokens + value.outputTokens);
        controller.enqueue(line(value));
      } catch (error) {
        if (!abort.signal.aborted) {
          logFailure("check", error);
          controller.enqueue(
            line({
              type: "error",
              message:
                "We couldn't finish reading just now. Your answers are safe.",
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
