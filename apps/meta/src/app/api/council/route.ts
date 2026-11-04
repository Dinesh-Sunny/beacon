import { z } from "zod";
import { POSTCODE_RE } from "@/engine/rules";
import { placeFor } from "@/server/council";
import { guard } from "@/server/guard";
import { json } from "@/server/http";

const Query = z.object({
  postcode: z.string().trim().toUpperCase().regex(POSTCODE_RE),
});

export async function GET(req: Request) {
  const blocked = guard(req, 0);
  if (blocked) return json({ error: blocked.message }, blocked.status);
  const q = Query.safeParse({
    postcode: new URL(req.url).searchParams.get("postcode") ?? "",
  });
  if (!q.success) return json({ error: "postcode" }, 400);
  try {
    return json(await placeFor(q.data.postcode));
  } catch {
    return json({ council: null, nation: null, error: "lookup" }, 502);
  }
}
