import { z } from "zod";
import { TOPICS } from "@/engine/rules";
import { guard } from "@/server/guard";
import { failure, json } from "@/server/http";
import { image } from "@/server/meta";

export const runtime = "nodejs";
export const maxDuration = 90;

// Muse Image paints the results banner. The prompt carries life areas only, never answers.
const SCENES: Record<string, string> = {
  low: "a warm kitchen table with a cup of tea and opened letters",
  dis: "a comfortable armchair with a walking stick resting beside it",
  care: "two cups of tea side by side on a windowsill",
  fam: "a pram and small wellington boots by the front door",
  work: "a coat and bag on a hook, ready for the day",
  sick: "a cosy blanket on a sofa by a sunny window",
  death: "a vase of fresh flowers on a sideboard",
};

const Body = z.object({ topics: z.array(z.enum(TOPICS.map(([t]) => t) as [string, ...string[]])).min(1).max(7) });

export async function POST(req: Request) {
  const blocked = guard(req, 3);
  if (blocked) return json({ error: blocked.message }, blocked.status);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad-request" }, 400);
  const scene = parsed.data.topics.map((t) => SCENES[t]).filter(Boolean).slice(0, 3).join(", ");
  const prompt = `A warm, hopeful gouache illustration of a calm British home on a bright morning: ${scene}. Through the window, a small lighthouse on a green hill sends a soft golden beam across the room. Soft stone and cream colours with gentle amber light, simple shapes, plenty of calm space. No text, no letters, no words, no logos, no faces.`;
  try {
    return json({ image: await image(prompt, "1792x768") });
  } catch (err) {
    return failure(err);
  }
}
