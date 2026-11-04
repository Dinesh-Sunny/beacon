import { z } from "zod";
import { AnswersSchema } from "@/engine/answers-schema";
import { isLocale, localeInfo } from "@/i18n/locales";
import { runAgent } from "@/server/agent";
import { guard } from "@/server/guard";
import { failure, json } from "@/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(16),
  answers: AnswersSchema,
  subject: z
    .object({
      who: z.enum(["me", "other"]),
      label: z.string().max(20).optional(),
    })
    .optional(),
  locale: z.string().max(8).optional(),
  /** The Simple words display setting: easy-read replies. */
  simple: z.boolean().optional(),
});

export async function POST(req: Request) {
  const blocked = guard(req);
  if (blocked) return json({ error: blocked.message }, blocked.status);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad-request" }, 400);
  const { messages, answers, subject, locale, simple } = parsed.data;
  const language = isLocale(locale) ? localeInfo(locale).english : undefined;
  if (!req.headers.get("accept")?.includes("application/x-ndjson")) {
    try {
      return json(
        await runAgent(messages, answers, subject, undefined, language, simple),
      );
    } catch (err) {
      return failure(err);
    }
  }
  // Streamed: one JSON line per tool step as it happens, then the final reply.
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) =>
        controller.enqueue(enc.encode(`${JSON.stringify(o)}\n`));
      try {
        const out = await runAgent(
          messages,
          answers,
          subject,
          (step) => send({ type: "step", ...step }),
          language,
          simple,
        );
        send({ type: "done", ...out });
      } catch (err) {
        const res = failure(err);
        const body = (await res.json()) as { error?: string };
        send({ type: "error", error: body.error ?? "model" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  });
}
