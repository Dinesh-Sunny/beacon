import { LIMITS } from "@beacon/brain/config";
import { z } from "zod";
import { explainLetter } from "@/lib/check-client";
import { limit, logFailure, readBody } from "@/lib/guard";
import { recordTokens } from "@/lib/rate-limit";

const BodySchema = z.object({
  letter: z.string().trim().min(40).max(LIMITS.letterChars),
});

// "Explain my letter": the pasted text is cleaned of identifiers in code, read once by Beam and
// never stored or logged.
export async function POST(request: Request) {
  const read = await readBody(request, "letter");
  if (read instanceof Response) return read;
  const parsed = BodySchema.safeParse(read.body);
  if (!parsed.success)
    return Response.json(
      {
        message: `Paste the words from your letter, between 40 and ${LIMITS.letterChars.toLocaleString("en-GB")} letters long.`,
      },
      { status: 400 },
    );
  const busy = limit(request, "letter");
  if (busy) return busy;

  try {
    const { text, removed, usage } = await explainLetter(parsed.data.letter, {
      signal: request.signal,
    });
    recordTokens(usage.inputTokens + usage.outputTokens);
    return Response.json({ text, removed });
  } catch (error) {
    logFailure("letter", error);
    return Response.json(
      {
        message:
          "We couldn't read your letter just now. Nothing was kept. Please try again in a few minutes.",
      },
      { status: 503 },
    );
  }
}
