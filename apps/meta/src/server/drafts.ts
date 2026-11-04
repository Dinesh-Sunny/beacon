import "server-only";

// Drafting: Muse Spark reads the stored text of a page that triage marked as help, and writes
// a draft scheme in Beacon's rule language. Code validates every draft against the same zod
// schema the live packs use; a draft that fails, or needs facts Beacon doesn't ask yet, is kept
// with the reason. Drafts live in catalog/drafts and never reach a person until reviewed into a pack.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { FACT_IDS } from "@/engine/answers-schema";
import { DERIVED_KEYS, SchemeSchema } from "@/engine/pack";
import { mapLimit } from "@/knowledge/fetcher";
import type { SourceIndex } from "@/knowledge/sources";
import { chat } from "./meta";
import type { TriageRow } from "./triage";

/** What each derived value means, so the model can only write rules the engine can run. */
const DERIVED_DOC: Record<(typeof DERIVED_KEYS)[number], string> = {
  nation: '"eng" | "sco" | "wal" | "ni" (from postcode)',
  age: "years (from dob)",
  spa: "true if reached State Pension age (from dob)",
  gateway: "true if gets Universal Credit or Pension Credit (from benefits)",
  incWeek: "household income after tax, pounds a week (from income)",
  incYear: "the same, a year (from income)",
  sav: "savings in pounds (from savings)",
  health: '"none" | "daily" | "care": help needed with daily tasks or personal care (from difficulties)',
  move: "true if difficulty walking or getting around (from difficulties)",
  work: '"employed" | "self" | "none" | "sick" (from work)',
  hours: "hours worked a week (from work)",
  lowWork: "true if not working or under 16 hours (from work)",
  ni: "true if paid National Insurance in the last 2 to 3 years (from ni)",
  childAge: "age of youngest child in years, 999 if none (from child)",
  pregnant: "true if expecting a baby (from pregnant)",
  careHours: "hours a week caring for someone (from careHours)",
  ctax: "true if pays council tax (from ctax)",
  bereaved: '"no" | "partner" | "funeral" (from bereaved)',
  housing: '"social" | "private" | "own" | "family" (from housing)',
};

const Cmp = z.strictObject({ f: z.enum(DERIVED_KEYS), op: z.enum(["eq", "ne", "lt", "lte", "gt", "gte", "in"]), v: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]) });
const Draft = z.strictObject({
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

const SYSTEM = `You turn one official UK page into a draft rule for Beacon, a screening tool. UK English, plain words, "you" voice, never the word "eligible", regular hyphens only.
Write ONLY conditions the page states. Each condition is an "anyOf" list of comparisons over these values:
${Object.entries(DERIVED_DOC).map(([k, d]) => `- ${k}: ${d}`).join("\n")}
"needs" lists the answer ids the comparisons depend on: ${FACT_IDS.join(", ")}.
Use "nations" for where it applies; don't also write a nation condition. If a rule depends on something none of these values cover (for example a water meter, a specific medical condition, immigration status, a job), put it in "missingFacts" in plain words instead of guessing. If only a full assessment can decide, set worthChecking to a short reason. "gives" is one short sentence of what the person gets, "how" one or two sentences on claiming. auto is true only if the page says it is paid without a claim.`;

const SCHEMA = z.toJSONSchema(Draft);

export interface DraftRow {
  url: string;
  provider: string | null;
  draft?: z.infer<typeof Draft>;
  /** The draft converted to the live pack shape, if it validated. */
  scheme?: unknown;
  problems: string[];
}

function toScheme(d: z.infer<typeof Draft>, url: string, topic: string) {
  const rule = [
    ...(d.nations.length && d.nations.length < 4
      ? [{ needs: ["postcode"], test: { f: "nation", op: "in", v: d.nations }, expr: `lives in ${d.nations.join(", ")}`, txt: "Lives where this applies", fail: "Not offered where they live" }]
      : []),
    ...d.conditions.map((c) => {
      const parts = c.anyOf.map((x) => (x.op === "in" ? { f: x.f, op: "in", v: Array.isArray(x.v) ? x.v.map(String) : [String(x.v)] } : x));
      return { needs: c.needs, test: parts.length === 1 ? parts[0] : { any: parts }, expr: c.txt.toLowerCase(), txt: c.txt, fail: c.fail };
    }),
  ];
  return {
    id: d.id,
    name: d.name,
    topic,
    by: d.by,
    gives: d.gives,
    how: d.how,
    url,
    ...(d.auto ? { auto: true } : {}),
    ...(d.worthChecking ? { worthChecking: d.worthChecking } : {}),
    rule,
  };
}

export const draftProgress = { running: false, total: 0, done: 0, valid: 0, needsFacts: 0, failed: 0 };

export async function draftAll(root: string, { parallel = 4, limit = 2000 } = {}) {
  const triage: Record<string, TriageRow> = JSON.parse(await readFile(path.join(root, "catalog/harvest/triage.json"), "utf8"));
  const index: SourceIndex = JSON.parse(await readFile(path.join(root, "catalog/sources/index.json"), "utf8"));
  const dir = path.join(root, "catalog/drafts");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, "drafts.json");
  const kept: Record<string, DraftRow> = JSON.parse(await readFile(file, "utf8").catch(() => "{}"));
  const todo = Object.values(triage)
    .filter((t) => t.support && index[t.url] && !kept[t.url])
    .slice(0, limit);
  Object.assign(draftProgress, { running: true, total: todo.length, done: 0, valid: 0, needsFacts: 0, failed: 0 });
  let writing = Promise.resolve();
  const persist = () => (writing = writing.then(() => writeFile(file, `${JSON.stringify(kept, null, 1)}\n`)));

  await mapLimit(todo, parallel, async (t) => {
    const row: DraftRow = { url: t.url, provider: t.provider, problems: [] };
    try {
      const text = (await readFile(path.join(root, "catalog/sources", index[t.url]?.file ?? ""), "utf8")).slice(0, 14_000);
      const { message } = await chat({
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Page: ${t.url}\n\n${text}` },
        ],
        schema: { name: "draft_scheme", schema: SCHEMA },
        effort: "low",
        maxTokens: 3000,
        cacheKey: "beacon-draft-v1",
      });
      row.draft = Draft.parse(JSON.parse(message.content ?? "{}"));
      const scheme = toScheme(row.draft, t.url, t.provider ?? "other");
      const check = SchemeSchema.safeParse(scheme);
      if (check.success) row.scheme = check.data;
      else row.problems.push(...check.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
      if (row.draft.missingFacts.length) draftProgress.needsFacts++;
      if (row.scheme) draftProgress.valid++;
    } catch (e) {
      row.problems.push((e as Error).message);
      draftProgress.failed++;
    }
    kept[t.url] = row;
    draftProgress.done++;
    await persist();
  });
  draftProgress.running = false;
  return draftProgress;
}
