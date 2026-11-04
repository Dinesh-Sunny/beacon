import { z } from "zod";
import { AnswersSchema } from "@/engine/answers-schema";
import { SCHEMES } from "@/engine/rules";
import { guard } from "@/server/guard";
import { failure, json } from "@/server/http";
import { prepareCall } from "@/server/prepare";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  scheme: z.enum(SCHEMES.map((s) => s.id) as [string, ...string[]]),
  answers: AnswersSchema,
  subject: z
    .object({
      who: z.enum(["me", "other"]),
      label: z.string().max(20).optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const blocked = guard(req);
  if (blocked) return json({ error: blocked.message }, blocked.status);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad-request" }, 400);
  try {
    return json(
      await prepareCall(
        parsed.data.scheme,
        parsed.data.answers,
        parsed.data.subject,
      ),
    );
  } catch (err) {
    return failure(err);
  }
}
