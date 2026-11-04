// The shape Muse Spark writes a draft scheme in: flat comparisons over the engine's derived
// values, so code can turn it into a pack rule. Shared by the drafting job and the review script.
import { z } from "zod";
import { FACT_IDS } from "../engine/answers-schema.ts";
import { DERIVED_KEYS } from "../engine/pack.ts";

const Cmp = z.strictObject({ f: z.enum(DERIVED_KEYS), op: z.enum(["eq", "ne", "lt", "lte", "gt", "gte", "in"]), v: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]) });
export const Draft = z.strictObject({
  id: z.string().regex(/^[a-z]{2,12}$/),
  name: z.string(),
  by: z.string(),
  gives: z.string(),
  how: z.string(),
  nations: z.array(z.enum(["eng", "sco", "wal", "ni"])),
  auto: z.boolean(),
  worthChecking: z.string().nullable(),
  conditions: z.array(
    z.strictObject({ needs: z.array(z.enum(FACT_IDS)).min(1), anyOf: z.array(Cmp).min(1), txt: z.string(), fail: z.string() }),
  ),
  missingFacts: z.array(z.string()),
});

export type DraftT = z.infer<typeof Draft>;
