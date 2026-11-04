import { PACK, SCHEMES } from "@/engine/rules";
import { json } from "@/server/http";

// For uptime checks and the deploy smoke test: what's live, never any person's data.
export function GET() {
  return json({
    ok: true,
    pack: { id: PACK.id, version: PACK.version, checked: PACK.checked, schemes: SCHEMES.length },
    models: Boolean(process.env.MODEL_API_KEY),
  });
}
