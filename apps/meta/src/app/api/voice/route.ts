import { guard } from "@/server/guard";
import { failure, json } from "@/server/http";
import { transcribe } from "@/server/meta";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // about 2 minutes of 16 kHz speech

export async function POST(req: Request) {
  const blocked = guard(req);
  if (blocked) return json({ error: blocked.message }, blocked.status);
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size < 1000)
    return json({ error: "empty" }, 400);
  if (audio.size > MAX_BYTES) return json({ error: "too-long" }, 413);
  const head = new Uint8Array(await audio.slice(0, 12).arrayBuffer());
  const tag =
    String.fromCharCode(...head.slice(0, 4)) +
    String.fromCharCode(...head.slice(8, 12));
  if (tag !== "RIFFWAVE") return json({ error: "format" }, 400);
  try {
    const transcript = await transcribe(audio);
    return json({ transcript });
  } catch (err) {
    return failure(err);
  }
}
