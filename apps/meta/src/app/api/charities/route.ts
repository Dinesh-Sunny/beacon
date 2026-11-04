import { z } from "zod";
import { POSTCODE_RE } from "@/engine/rules";
import { fundsFor } from "@/server/charities";
import { placeFor } from "@/server/council";
import { guard } from "@/server/guard";
import { json } from "@/server/http";

// Grant-giving charities for a postcode and a few people-group ids. Only the area is used.
const Query = z.object({
  postcode: z.string().trim().toUpperCase().regex(POSTCODE_RE),
  groups: z
    .string()
    .max(120)
    .transform((s) => s.split(",").filter((g) => /^[a-z]+$/.test(g))),
});

export async function GET(req: Request) {
  const blocked = guard(req, 0);
  if (blocked) return json({ error: blocked.message }, blocked.status);
  const p = new URL(req.url).searchParams;
  const q = Query.safeParse({
    postcode: p.get("postcode") ?? "",
    groups: p.get("groups") ?? "",
  });
  if (!q.success) return json({ error: "query" }, 400);
  try {
    const place = await placeFor(q.data.postcode);
    return json(
      fundsFor(
        { areas: place.areas ?? [], nation: place.nation },
        q.data.groups,
      ),
    );
  } catch (e) {
    console.error("charities", (e as Error).message);
    return json({ error: "lookup" }, 502);
  }
}
