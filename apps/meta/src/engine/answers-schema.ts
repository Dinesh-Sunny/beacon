// The single source for what an answer can be. The Answers type, the request validation on the
// server, the fact ids the rule packs may name and the model's fact patch all derive from here.
import { z } from "zod";

export const UNSURE = "unsure" as const;
export type Unsure = typeof UNSURE;
const unsure = z.literal(UNSURE);
const orUnsure = <T extends z.ZodType>(t: T) => z.union([t, unsure]);

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const YesNo = z.enum(["yes", "no"]);
export const Period = z.enum(["week", "month", "year"]);
export const WorkStatus = z.enum(["employed", "self", "none", "sick"]);
export const Benefit = z.enum(["uc", "pc", "pip", "cb"]);
export const Difficulty = z.enum(["wash", "night", "cook", "move"]);
export const Bereaved = z.enum(["no", "partner", "funeral"]);
export const Housing = z.enum(["social", "private", "own", "family"]);
export const Household = z.enum(["alone", "children", "partner", "adults"]);

export const Money = z.object({ amt: z.number().min(0), per: Period });
export const Work = z.object({
  status: WorkStatus,
  hours: z.number().min(0).max(168).optional(),
});

export const AnswersSchema = z
  .object({
    postcode: orUnsure(z.string().max(10)),
    dob: orUnsure(IsoDate),
    benefits: orUnsure(z.array(Benefit).max(Benefit.options.length)),
    income: orUnsure(Money),
    savings: orUnsure(z.number().min(0)),
    difficulties: orUnsure(z.array(Difficulty).max(Difficulty.options.length)),
    work: orUnsure(Work),
    ni: orUnsure(YesNo),
    child: orUnsure(z.union([IsoDate, z.literal("none")])),
    pregnant: orUnsure(YesNo),
    careHours: orUnsure(z.number().min(0).max(168)),
    ctax: orUnsure(YesNo),
    housing: orUnsure(Housing),
    household: orUnsure(Household),
    debt: orUnsure(YesNo),
    bereaved: orUnsure(Bereaved),
    /** True when the date of birth was worked out from an age, so it reads back as an age. */
    dobApprox: z.boolean(),
  })
  .partial();

export type Answers = z.infer<typeof AnswersSchema>;
export type FactId = Exclude<keyof Answers, "dobApprox">;
export const FACT_IDS = AnswersSchema.keyof().options.filter(
  (k): k is FactId => k !== "dobApprox",
);
