import { LIMITS } from "@beacon/brain/config";
import { z } from "zod";
import { explainLetter } from "@/lib/check-client";
import { env } from "@/lib/env";
import { clientIp, takeCheckSlot } from "@/lib/rate-limit";

const BodySchema = z.object({
  letter: z.string().trim().min(40).max(LIMITS.letterChars),
});

// "Explain my letter": the pasted text is cleaned of identifiers in code, read once by Beam and
// never stored or logged.
export async function POST(request: Request) {
  const limit = takeCheckSlot(
    clientIp(request.headers),
    env.BEACON_PER_IP_PER_MINUTE,
    env.BEACON_DAILY_CAP,
  );
  if (!limit.ok)
    return Response.json(
      {
        message:
          "Lots of people are using Beacon right now. Try again in about 2 minutes.",
      },
      { status: 429 },
    );

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      {
        message: `Paste the words from your letter, between 40 and ${LIMITS.letterChars.toLocaleString("en-GB")} letters long.`,
      },
      { status: 400 },
    );

  try {
    const { text, removed } = await explainLetter(parsed.data.letter, {
      signal: request.signal,
    });
    return Response.json({ text, removed });
  } catch (error) {
    console.error(`[letter] ${(error as Error).name}`);
    return Response.json(
      {
        message:
          "We couldn't read your letter just now. Nothing was kept. Please try again in a few minutes.",
      },
      { status: 503 },
    );
  }
}
