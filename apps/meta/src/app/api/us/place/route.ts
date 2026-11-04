import { z } from "zod";
import { guard } from "@/server/guard";
import { json } from "@/server/http";
import { usPlaceFor } from "@/server/usplace";

const Query = z.object({ zip: z.string().regex(/^\d{5}$/) });

export async function GET(req: Request) {
  const blocked = guard(req, 0);
  if (blocked) return json({ error: blocked.message }, blocked.status);
  const q = Query.safeParse({
    zip: new URL(req.url).searchParams.get("zip") ?? "",
  });
  if (!q.success) return json({ error: "zip" }, 400);
  try {
    const { lat: _lat, lon: _lon, ...place } = await usPlaceFor(q.data.zip);
    return json(place);
  } catch {
    return json({ error: "lookup" }, 502);
  }
}
