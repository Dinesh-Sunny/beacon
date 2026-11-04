import { z } from "zod";
import { guard } from "@/server/guard";
import { failure, json } from "@/server/http";
import { readLetter } from "@/server/letter";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  image: z
    .string()
    .max(4_000_000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
});

export async function POST(req: Request) {
  const blocked = guard(req, 2);
  if (blocked) return json({ error: blocked.message }, blocked.status);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad-request" }, 400);
  try {
    return json(await readLetter(parsed.data.image));
  } catch (err) {
    return failure(err);
  }
}
