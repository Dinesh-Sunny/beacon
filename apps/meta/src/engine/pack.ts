// Rule packs: schemes, screening lines and clash notes as data, validated with zod on load.
// A pack changes by a reviewed data edit (or the knowledge job's pull request), never a code change.
// Packs are layered: each new group of help (bills, health costs, councils ...) is its own file,
// and `composePacks` merges them into one registry, checking every reference across all of them.
// The tiny expression language below is all the engine needs: compare a derived fact to a value
// or to a named screening line, and combine with any / all.

import { z } from "zod";
import { FACT_IDS } from "./answers-schema.ts";

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
  "housing",
  "uc",
  "pc",
  "bornOn",
  "childBornOn",
  "livesAlone",
  "couple",
  "debt",
] as const;
export type DerivedKey = (typeof DERIVED_KEYS)[number];

const Scalar = z.union([z.string(), z.number(), z.boolean()]);
const LineRef = z.strictObject({ line: z.string() });

export type Expr =
  | {
      f: DerivedKey;
      op: "eq" | "ne" | "lt" | "lte" | "gt" | "gte";
      v: string | number | boolean | { line: string };
    }
  | { f: DerivedKey; op: "in"; v: string[] }
  | { any: Expr[] }
  | { all: Expr[] };

export const ExprSchema: z.ZodType<Expr> = z.lazy(() =>
  z.union([
    z.strictObject({
      f: z.enum(DERIVED_KEYS),
      op: z.enum(["eq", "ne", "lt", "lte", "gt", "gte"]),
      v: z.union([Scalar, LineRef]),
    }),
    z.strictObject({
      f: z.enum(DERIVED_KEYS),
      op: z.literal("in"),
      v: z.array(z.string()).min(1),
    }),
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
  near: z
    .strictObject({ f: z.enum(DERIVED_KEYS), line: z.string() })
    .optional(),
  gate: z.literal(true).optional(),
});
export type Cond = z.infer<typeof CondSchema>;

const Id = z.string().regex(/^[a-z]+$/);
export type Topic = string;

export const SchemeSchema = z.strictObject({
  id: Id,
  name: z.string(),
  topic: Id,
  by: z.string(),
  gives: z.string(),
  how: z.string(),
  /** Wording that differs by nation, e.g. { "sco": { "how": "Ask your supplier.", "timing": "" } }. */
  local: z
    .partialRecord(
      z.enum(["eng", "sco", "wal", "ni"]),
      z.strictObject({
        how: z.string().optional(),
        timing: z.string().optional(),
      }),
    )
    .optional(),
  phone: z
    .string()
    .regex(/^0\d{3} \d{2,3} \d{4}$/)
    .optional(),
  url: z.url(),
  timing: z.string().optional(),
  /** Paid without a claim: true everywhere, or the nations where it is. */
  auto: z
    .union([z.boolean(), z.array(z.enum(["eng", "sco", "wal", "ni"]))])
    .optional(),
  /** Screening can't settle it, so the best result is "Worth checking", with this reason. */
  worthChecking: z.string().optional(),
  /** What it's worth at the published rates. Shown as a range; the organisation decides the amount. */
  worth: z
    .strictObject({
      min: z.number().positive().optional(),
      max: z.number().positive(),
      per: z.enum(["week", "month", "year", "once"]),
      /** A top-up to a weekly line: the amount is the line minus their weekly income. */
      topUpTo: z.strictObject({ line: z.string() }).optional(),
      source: z.url(),
      year: z.string().regex(/^\d{4}\/\d{2}$/),
    })
    .optional(),
  /** GOV.UK local service slug (e.g. "apply-council-tax-reduction"): with a council, it links straight to that council's page. */
  council: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  /** Label for the official link when it isn't a claim form, like "Ask your provider". */
  act: z.string().optional(),
  urgent: z.boolean().optional(),
  rule: z.array(CondSchema).min(1),
  opens: z.array(z.string()).optional(),
});
export type Scheme = z.infer<typeof SchemeSchema>;

const ClashSchema = z.strictObject({
  ids: z.array(z.string()).min(1),
  tone: z.enum(["warn", "boost"]),
  text: z.string(),
  when: ExprSchema.optional(),
});

/** One pack file. References may point into other packs, so they are checked by `composePacks`. */
export const PackSchema = z.strictObject({
  $schema: z.string().optional(),
  id: z.string().regex(/^[a-z]+(-[a-z]+)*$/),
  country: z.string().length(2),
  version: z.string().regex(/^\d{4}\.\d{2}\.\d{2}$/),
  checked: z.iso.date(),
  near: z.number().min(0).max(0.5).optional(),
  lines: z
    .record(
      z.string(),
      z.strictObject({
        value: z.number(),
        source: z.url(),
        note: z.string().optional(),
      }),
    )
    .default({}),
  gateways: z.array(z.string()).default([]),
  topics: z.array(z.tuple([Id, z.string()])),
  /** Nations this pack does not cover, with where to go instead. Applies to this pack's schemes only. */
  notCovered: z.record(z.string(), z.string()).default({}),
  schemes: z.array(SchemeSchema).min(1),
  clashes: z.array(ClashSchema).default([]),
  /** How to challenge a decision, keyed by who decides (a scheme's "by"), for the Confirm step. */
  challenges: z
    .record(z.string(), z.strictObject({ text: z.string(), url: z.url() }))
    .default({}),
});
export type Pack = z.infer<typeof PackSchema>;

export type PackedScheme = Scheme & {
  pack: string;
  notCovered: Record<string, string>;
};

/** Every pack merged into one registry: one namespace for scheme ids, lines and topics. */
export interface Registry {
  /** Stable cache key for everything derived from the rules, e.g. "uk-core@2026.11.04+uk-bills@2026.11.04". */
  version: string;
  packs: { id: string; version: string; checked: string; schemes: number }[];
  near: number;
  lines: Pack["lines"];
  gateways: string[];
  topics: [Topic, string][];
  schemes: PackedScheme[];
  clashes: Pack["clashes"];
  challenges: Pack["challenges"];
}

const refs = (e: Expr): string[] =>
  "any" in e
    ? e.any.flatMap(refs)
    : "all" in e
      ? e.all.flatMap(refs)
      : typeof e.v === "object" && !Array.isArray(e.v)
        ? [e.v.line]
        : [];

function dupes(xs: string[]): string[] {
  const seen = new Set<string>();
  return [...new Set(xs.filter((x) => seen.has(x) || !seen.add(x)))];
}

/** Validates each pack, then every id, line, topic and cross-pack reference, then merges them in order. */
export const RegistrySchema = z
  .array(PackSchema)
  .min(1)
  .superRefine((packs, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const schemes = packs.flatMap((p) => p.schemes);
    const ids = new Set(schemes.map((s) => s.id));
    const lines = new Set(packs.flatMap((p) => Object.keys(p.lines)));
    const topics = new Set(packs.flatMap((p) => p.topics.map(([t]) => t)));
    for (const d of dupes(packs.map((p) => p.id)))
      fail(`pack ${d} loaded twice`);
    for (const d of dupes(schemes.map((s) => s.id)))
      fail(`scheme id ${d} is used twice`);
    for (const d of dupes(packs.flatMap((p) => Object.keys(p.lines))))
      fail(`line ${d} is defined twice`);
    for (const d of dupes(packs.flatMap((p) => p.topics.map(([t]) => t))))
      fail(`topic ${d} is defined twice`);
    for (const s of schemes) {
      if (!topics.has(s.topic)) fail(`${s.id} uses unknown topic ${s.topic}`);
      for (const o of s.opens ?? [])
        if (!ids.has(o)) fail(`${s.id} opens unknown ${o}`);
      for (const c of s.rule)
        for (const l of [...refs(c.test), ...(c.near ? [c.near.line] : [])])
          if (!lines.has(l)) fail(`${s.id} uses unknown line ${l}`);
    }
    for (const p of packs) {
      for (const g of p.gateways)
        if (!ids.has(g)) fail(`${p.id}: unknown gateway ${g}`);
      for (const c of p.clashes)
        for (const id of c.ids)
          if (!ids.has(id)) fail(`${p.id}: clash names unknown ${id}`);
    }
  })
  .transform(
    (packs): Registry => ({
      version: packs.map((p) => `${p.id}@${p.version}`).join("+"),
      packs: packs.map((p) => ({
        id: p.id,
        version: p.version,
        checked: p.checked,
        schemes: p.schemes.length,
      })),
      near: packs[0]?.near ?? 0.1,
      lines: Object.assign({}, ...packs.map((p) => p.lines)),
      gateways: packs.flatMap((p) => p.gateways),
      topics: packs.flatMap((p) => p.topics),
      schemes: packs.flatMap((p) =>
        p.schemes.map((s) => ({ ...s, pack: p.id, notCovered: p.notCovered })),
      ),
      clashes: packs.flatMap((p) => p.clashes),
      challenges: Object.assign({}, ...packs.map((p) => p.challenges)),
    }),
  );

export type DerivedValues = Partial<
  Record<DerivedKey, string | number | boolean | null>
>;

/** Evaluates one expression. Undefined facts make a comparison false; callers check "needs" first. */
export function run(e: Expr, d: DerivedValues, lines: Pack["lines"]): boolean {
  if ("any" in e) return e.any.some((x) => run(x, d, lines));
  if ("all" in e) return e.all.every((x) => run(x, d, lines));
  const have = d[e.f];
  if (have === undefined || have === null) return false;
  if (e.op === "in") return e.v.includes(String(have));
  const want =
    typeof e.v === "object" ? (lines[e.v.line]?.value ?? Number.NaN) : e.v;
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
