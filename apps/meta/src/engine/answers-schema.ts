// Validates the answers a browser sends with a request. The server keeps nothing; it only
// needs them to run the rules for this one call.
import { z } from "zod";

const unsure = z.literal("unsure");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const AnswersSchema = z
  .object({
    postcode: z.union([z.string().max(10), unsure]),
    dob: z.union([date, unsure]),
    benefits: z.union([z.array(z.enum(["uc", "pc", "pip", "cb"])).max(4), unsure]),
    income: z.union([z.object({ amt: z.number().min(0), per: z.enum(["week", "month", "year"]) }), unsure]),
    savings: z.union([z.number().min(0), unsure]),
    difficulties: z.union([z.array(z.enum(["wash", "night", "cook", "move"])).max(4), unsure]),
    work: z.union([z.object({ status: z.enum(["employed", "self", "none", "sick"]), hours: z.number().min(0).max(168).optional() }), unsure]),
    ni: z.enum(["yes", "no", "unsure"]),
    child: z.union([date, z.literal("none"), unsure]),
    pregnant: z.enum(["yes", "no", "unsure"]),
    careHours: z.union([z.number().min(0).max(168), unsure]),
    ctax: z.enum(["yes", "no", "unsure"]),
    bereaved: z.enum(["no", "partner", "funeral", "unsure"]),
  })
  .partial();
