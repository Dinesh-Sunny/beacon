import "server-only";

// Drafting: Muse Spark reads the stored text of a page that triage marked as help, and writes
// a draft scheme in Beacon's rule language. Every draft is kept by URL, and one that needs facts
// Beacon doesn't ask yet records them
// with the reason. This step only needs the model; turning drafts into pack schemes and checking
// them is pure code (src/knowledge/review.ts), so it runs anywhere and can be re-run for free.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { FACT_IDS } from "@/engine/answers-schema";
import { DERIVED_KEYS } from "@/engine/pack";
import { Draft } from "@/knowledge/draft-schema";
import { FACT_HINTS } from "@/knowledge/review";
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

const SYSTEM = `You turn one official UK page into a draft rule for Beacon, a screening tool. UK English, plain words, "you" voice, never the word "eligible", regular hyphens only.
Write ONLY conditions the page states. Each condition is an "anyOf" list of comparisons over these values:
${Object.entries(DERIVED_DOC).map(([k, d]) => `- ${k}: ${d}`).join("\n")}
"needs" lists the answer ids the comparisons depend on: ${FACT_IDS.join(", ")}.
Use "nations" for where it applies; don't also write a nation condition. If a rule depends on something none of these values cover, put it in "missingFacts" instead of guessing: use one of these proposed ids when it fits (${Object.keys(FACT_HINTS).join(", ")}), otherwise a few plain words. Leave out conditions every claim has: residence, immigration status, notice, proof, evidence and how to apply. If only a full assessment can decide, set worthChecking to a short reason. "gives" is one short sentence of what the person gets, "how" one or two sentences on claiming. auto is true only if the page says it is paid without a claim.`;

const SCHEMA = z.toJSONSchema(Draft);

export interface DraftRow {
  url: string;
  provider: string | null;
  draft?: z.infer<typeof Draft>;
  problems: string[];
}

export const draftProgress = { running: false, total: 0, done: 0, valid: 0, needsFacts: 0, failed: 0 };

export async function draftAll(root: string, { parallel = 6, limit = 2000 } = {}) {
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
        cacheKey: "beacon-draft-v2",
      });
      row.draft = Draft.parse(JSON.parse(message.content ?? "{}"));
      if (row.draft.missingFacts.length) draftProgress.needsFacts++;
      else draftProgress.valid++;
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
