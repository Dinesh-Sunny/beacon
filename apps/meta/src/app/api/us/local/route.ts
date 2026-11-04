import { z } from "zod";
import { guard } from "@/server/guard";
import { json } from "@/server/http";
import { usLocalFor } from "@/server/uslocal";
import { usPlaceFor } from "@/server/usplace";

// Health centers, housing agencies and housing counselors nearest a ZIP code.
const Query = z.object({ zip: z.string().regex(/^\d{5}$/) });

export async function GET(req: Request) {
  const blocked = guard(req, 0);
  if (blocked) return json({ error: blocked.message }, blocked.status);
  const q = Query.safeParse({
    zip: new URL(req.url).searchParams.get("zip") ?? "",
  });
  if (!q.success) return json({ error: "zip" }, 400);
  try {
    const place = await usPlaceFor(q.data.zip);
    if (!place.state || place.lat === null || place.lon === null)
      return json({ error: "unknown" }, 404);
    return json({
      place: { state: place.state, city: place.city, county: place.county },
      ...usLocalFor(place.state, place.lat, place.lon),
    });
  } catch (e) {
    console.error("us local", (e as Error).message);
    return json({ error: "lookup" }, 502);
  }
}
