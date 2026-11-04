import { z } from "zod";
import { AnswersSchema } from "@/engine/answers-schema";
import { runAgent } from "@/server/agent";
import { guard } from "@/server/guard";
import { failure, json } from "@/server/http";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(16),
  answers: AnswersSchema,
});

export async function POST(req: Request) {
  const blocked = guard(req);
  if (blocked) return json({ error: blocked.message }, blocked.status);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad-request" }, 400);
  try {
    const out = await runAgent(parsed.data.messages, parsed.data.answers);
    return json(out);
  } catch (err) {
    return failure(err);
  }
}
