// Rule packs: schemes, screening lines and clash notes as data, validated with zod on load.
// A pack changes by a reviewed data edit (or the knowledge job's pull request), never a code change.
// The tiny expression language below is all the engine needs: compare a derived fact to a value
// or to a named screening line, and combine with any / all.

import { z } from "zod";

export const DERIVED_KEYS = [
  "nation",
  "age",
  "spa",
  "gateway",
  "incWeek",
  "incYear",
  "sav",
  "health",
  "move",
  "work",
  "hours",
  "lowWork",
  "ni",
  "childAge",
  "pregnant",
  "careHours",
  "ctax",
  "bereaved",
] as const;
export type DerivedKey = (typeof DERIVED_KEYS)[number];

const FACT_IDS = ["postcode", "dob", "benefits", "income", "savings", "difficulties", "work", "ni", "child", "pregnant", "careHours", "ctax", "bereaved"] as const;

const Scalar = z.union([z.string(), z.number(), z.boolean()]);
const LineRef = z.strictObject({ line: z.string() });

export type Expr =
  | { f: DerivedKey; op: "eq" | "ne" | "lt" | "lte" | "gt" | "gte"; v: string | number | boolean | { line: string } }
  | { f: DerivedKey; op: "in"; v: string[] }
  | { any: Expr[] }
  | { all: Expr[] };

export const ExprSchema: z.ZodType<Expr> = z.lazy(() =>
  z.union([
    z.strictObject({ f: z.enum(DERIVED_KEYS), op: z.enum(["eq", "ne", "lt", "lte", "gt", "gte"]), v: z.union([Scalar, LineRef]) }),
    z.strictObject({ f: z.enum(DERIVED_KEYS), op: z.literal("in"), v: z.array(z.string()).min(1) }),
    z.strictObject({ any: z.array(ExprSchema).min(1) }),
    z.strictObject({ all: z.array(ExprSchema).min(1) }),
  ]),
);

const CondSchema = z.strictObject({
  needs: z.array(z.enum(FACT_IDS)).min(1),
  test: ExprSchema,
  expr: z.string(),
  txt: z.string(),
  fail: z.string(),
  near: z.strictObject({ f: z.enum(DERIVED_KEYS), line: z.string() }).optional(),
  gate: z.literal(true).optional(),
});
export type Cond = z.infer<typeof CondSchema>;

const TOPIC_IDS = ["low", "work", "sick", "fam", "dis", "care", "death"] as const;
export type Topic = (typeof TOPIC_IDS)[number];

const SchemeSchema = z.strictObject({
  id: z.string().regex(/^[a-z]+$/),
  name: z.string(),
  topic: z.enum(TOPIC_IDS),
  by: z.string(),
  gives: z.string(),
  how: z.string(),
  phone: z.string().regex(/^0\d{3} \d{2,3} \d{4}$/).optional(),
  url: z.url(),
  timing: z.string().optional(),
  auto: z.boolean().optional(),
  urgent: z.boolean().optional(),
  rule: z.array(CondSchema).min(1),
  opens: z.array(z.string()).optional(),
});
export type Scheme = z.infer<typeof SchemeSchema>;

export const PackSchema = z
  .strictObject({
    $schema: z.string().optional(),
    id: z.string(),
    country: z.string().length(2),
    version: z.string().regex(/^\d{4}\.\d{2}\.\d{2}$/),
    checked: z.iso.date(),
    near: z.number().min(0).max(0.5),
    lines: z.record(z.string(), z.strictObject({ value: z.number(), source: z.url(), note: z.string().optional() })),
    gateways: z.array(z.string()),
    topics: z.array(z.tuple([z.enum(TOPIC_IDS), z.string()])),
    notCovered: z.record(z.string(), z.string()),
    schemes: z.array(SchemeSchema).min(1),
    clashes: z.array(
      z.strictObject({
        ids: z.array(z.string()).min(1),
        tone: z.enum(["warn", "boost"]),
        text: z.string(),
        when: ExprSchema.optional(),
      }),
    ),
  })
  .superRefine((p, ctx) => {
    // Every reference inside the pack must point at something that exists.
    const ids = new Set(p.schemes.map((s) => s.id));
    const lines = new Set(Object.keys(p.lines));
    const refs = (e: Expr): string[] =>
      "any" in e ? e.any.flatMap(refs) : "all" in e ? e.all.flatMap(refs) : typeof e.v === "object" && !Array.isArray(e.v) ? [e.v.line] : [];
    for (const s of p.schemes) {
      for (const o of s.opens ?? []) if (!ids.has(o)) ctx.addIssue({ code: "custom", message: `${s.id} opens unknown ${o}` });
      for (const c of s.rule) {
        for (const l of [...refs(c.test), ...(c.near ? [c.near.line] : [])])
          if (!lines.has(l)) ctx.addIssue({ code: "custom", message: `${s.id} uses unknown line ${l}` });
      }
    }
    for (const g of p.gateways) if (!ids.has(g)) ctx.addIssue({ code: "custom", message: `unknown gateway ${g}` });
    for (const c of p.clashes) for (const id of c.ids) if (!ids.has(id)) ctx.addIssue({ code: "custom", message: `clash names unknown ${id}` });
  });
export type Pack = z.infer<typeof PackSchema>;

export type DerivedValues = Partial<Record<DerivedKey, string | number | boolean | null>>;

/** Evaluates one expression. Undefined facts make a comparison false; callers check "needs" first. */
export function run(e: Expr, d: DerivedValues, lines: Pack["lines"]): boolean {
  if ("any" in e) return e.any.some((x) => run(x, d, lines));
  if ("all" in e) return e.all.every((x) => run(x, d, lines));
  const have = d[e.f];
  if (have === undefined || have === null) return false;
  if (e.op === "in") return e.v.includes(String(have));
  const want = typeof e.v === "object" ? (lines[e.v.line]?.value ?? Number.NaN) : e.v;
  switch (e.op) {
    case "eq":
      return have === want;
    case "ne":
      return have !== want;
    case "lt":
      return Number(have) < Number(want);
    case "lte":
      return Number(have) <= Number(want);
    case "gt":
      return Number(have) > Number(want);
    case "gte":
      return Number(have) >= Number(want);
  }
}
