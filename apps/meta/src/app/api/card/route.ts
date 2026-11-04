import { z } from "zod";
import { TOPICS } from "@/engine/rules";
import { cached, keyOf, Lru } from "@/server/cache";
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
  food: "a full fruit bowl and a bag of fresh groceries on the counter",
  health: "a pair of reading glasses resting on a folded health insurance card",
  tax: "a neat stack of papers and a pencil beside a mug of coffee",
  vets: "a folded flag in a wooden frame on a bookshelf",
  rent: "a set of house keys on a small dish by the door",
  learn: "a stack of books and a notebook on a desk",
  home: "a warm radiator under a window with a draught excluder",
  found: "a small envelope and a piggy bank on a shelf",
};

// One banner per mix of life areas: after the first person, the rest cost nothing.
const banners = new Lru<string>(200, 7 * 24 * 60 * 60 * 1000);
const inflight = new Map<string, Promise<string>>();

const Body = z.object({
  topics: z
    .array(z.enum(TOPICS.map(([t]) => t) as [string, ...string[]]))
    .min(1)
    .max(16),
  country: z.enum(["GB", "US"]).optional(),
});

export async function POST(req: Request) {
  const blocked = guard(req, 3);
  if (blocked) return json({ error: blocked.message }, blocked.status);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad-request" }, 400);
  const topics = [...new Set(parsed.data.topics)].sort();
  const scene = topics
    .map((t) => SCENES[t])
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
  const place = parsed.data.country === "US" ? "American" : "British";
  const prompt = `A warm, hopeful gouache illustration of a calm ${place} home on a bright morning: ${scene}. Through the window, a small lighthouse on a green hill sends a soft golden beam across the room. Soft stone and cream colours with gentle amber light, simple shapes, plenty of calm space. No text, no letters, no words, no logos, no faces.`;
  try {
    const { value, hit } = await cached(
      banners,
      inflight,
      keyOf({ topics, place }),
      () => image(prompt, "1792x768"),
    );
    return json({ image: value, cached: hit });
  } catch (err) {
    return failure(err);
  }
}
