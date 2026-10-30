import {
  type Finding,
  ProposedFindingSchema,
  SCHEMES,
  type SchemeId,
  VERDICTS,
} from "@beacon/rules";
import { z } from "zod";
import { explainFinding } from "@/lib/check-client";
import { limit, logFailure, readBody } from "@/lib/guard";
import { recordTokens } from "@/lib/rate-limit";

const IDS = new Set<string>(SCHEMES.map((s) => s.id));

// The finding the browser holds. It may have been edited or come from a shared link, so the server
// re-reads the page and re-checks the quote before anything is written (explainFinding reverify).
const BodySchema = ProposedFindingSchema.extend({
  scheme: z.string().refine((id) => IDS.has(id)),
  verdict: z.enum(VERDICTS),
  quoteVerified: z.boolean(),
  source: z.object({
    url: z.string().max(300),
    title: z.string().max(200),
    readAt: z.string().max(40),
    publicUpdatedAt: z.string().max(40),
  }),
});

// "Help me with what to say": next steps and a call script or letter, written by Beam. Nothing is stored.
export async function POST(request: Request) {
  const read = await readBody(request, "explain");
  if (read instanceof Response) return read;
  const parsed = BodySchema.safeParse(read.body);
  if (!parsed.success)
    return Response.json(
      {
        message: "We could not read that result. Please go back and try again.",
      },
      { status: 400 },
    );
  const busy = limit(request, "explain");
  if (busy) return busy;

  try {
    const finding = {
      ...parsed.data,
      scheme: parsed.data.scheme as SchemeId,
    } satisfies Finding;
    const { text, usage } = await explainFinding(finding, {
      signal: request.signal,
      reverify: true,
    });
    recordTokens(usage.inputTokens + usage.outputTokens);
    return Response.json({ text });
  } catch (error) {
    logFailure("explain", error);
    return Response.json(
      {
        message:
          "We couldn't write this just now. The steps above still work, and your answers are safe.",
      },
      { status: 503 },
    );
  }
}
