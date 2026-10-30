import {
  type Finding,
  ProposedFindingSchema,
  SCHEMES,
  type SchemeId,
  VERDICTS,
} from "@beacon/rules";
import { z } from "zod";
import { explainFinding } from "@/lib/check-client";
import { env } from "@/lib/env";
import { clientIp, takeCheckSlot } from "@/lib/rate-limit";

const IDS = new Set<string>(SCHEMES.map((s) => s.id));

// The finding the browser already holds. It only shapes the text sent back to the same person,
// so it is validated for shape and size, not trusted as a decision.
const BodySchema = ProposedFindingSchema.extend({
  scheme: z.string().refine((id) => IDS.has(id)),
  verdict: z.enum(VERDICTS),
  quoteVerified: z.boolean(),
  source: z.object({
    url: z.url().max(300),
    title: z.string().max(200),
    readAt: z.string().max(40),
    publicUpdatedAt: z.string().max(40),
  }),
});

const BUSY =
  "Lots of people are using Beacon right now. Try again in about 2 minutes.";

// "Help me with what to say": next steps and a call script or letter, written by Beam. Nothing is stored.
export async function POST(request: Request) {
  const limit = takeCheckSlot(
    clientIp(request.headers),
    env.BEACON_PER_IP_PER_MINUTE,
    env.BEACON_DAILY_CAP,
  );
  if (!limit.ok) return Response.json({ message: BUSY }, { status: 429 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      {
        message: "We could not read that result. Please go back and try again.",
      },
      { status: 400 },
    );

  try {
    const finding = {
      ...parsed.data,
      scheme: parsed.data.scheme as SchemeId,
    } satisfies Finding;
    const { text, usage } = await explainFinding(finding, {
      signal: request.signal,
    });
    return Response.json({ text, usage });
  } catch (error) {
    console.error(`[explain] ${(error as Error).message}`);
    return Response.json(
      {
        message:
          "We couldn't write this just now. The steps above still work, and your answers are safe.",
      },
      { status: 503 },
    );
  }
}
