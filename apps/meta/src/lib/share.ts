// Share a check as a link. The answers are compressed with the browser's own CompressionStream
// and put in the link's #fragment, which browsers never send to a server, so Beacon still
// stores nothing. Opening the link validates everything with the answers schema first.

import { z } from "zod";
import { type Answers, AnswersSchema } from "@/engine/answers-schema";
import type { Subject } from "@/engine/facts";

const Shared = z.object({
  v: z.literal(1),
  a: AnswersSchema,
  s: z.object({
    who: z.enum(["me", "other"]),
    label: z.string().max(20).optional(),
  }),
});

const toB64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
const fromB64 = (s: string) =>
  Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
    c.charCodeAt(0),
  );

async function pipe(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(
    await new Response(
      new Blob([bytes]).stream().pipeThrough(stream),
    ).arrayBuffer(),
  );
}

export async function shareLink(
  answers: Answers,
  subject: Subject,
): Promise<string> {
  const json = new TextEncoder().encode(
    JSON.stringify({ v: 1, a: answers, s: subject }),
  );
  const packed = await pipe(json, new CompressionStream("deflate-raw"));
  return `${window.location.origin}/check#a=${toB64(packed)}`;
}

/** Reads a shared check from a #a= fragment, or null if there isn't a valid one. */
export async function readShared(
  hash: string,
): Promise<{ answers: Answers; subject: Subject } | null> {
  const m = /[#&]a=([\w-]+)/.exec(hash);
  if (!m?.[1]) return null;
  try {
    const raw = await pipe(
      fromB64(m[1]),
      new DecompressionStream("deflate-raw"),
    );
    const parsed = Shared.safeParse(JSON.parse(new TextDecoder().decode(raw)));
    return parsed.success
      ? { answers: parsed.data.a, subject: parsed.data.s }
      : null;
  } catch {
    return null;
  }
}
