import "server-only";

// Triage: Muse Spark sorts harvested pages into "is this help a person can get?" and tags each
// with the Beacon Framework's people and provider groups. Pages go in batches with a fixed
// system prompt (prompt-cache friendly), answers are checked by zod, and every verdict is kept in
// catalog/harvest/triage.json, so a page is never sent to the model twice.

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { mapLimit } from "@/knowledge/fetcher";
import { chat } from "./meta";

export const PEOPLE = ["older", "disabled", "carers", "families", "young", "outofwork", "lowpay", "events", "migrants", "helpers"] as const;
export const PROVIDERS = ["central", "devolved", "councils", "utilities", "schools", "nhs", "charities", "employ", "banks", "unclaimed", "legal"] as const;
export const KINDS = ["payment", "grant", "discount", "free", "loan", "tax", "credit", "register", "concession", "compensation", "unclaimed", "advice"] as const;

const Verdict = z.strictObject({
  i: z.int(),
  support: z.boolean(),
  name: z.string(),
  kind: z.enum(KINDS).nullable(),
  provider: z.enum(PROVIDERS).nullable(),
  people: z.array(z.enum(PEOPLE)),
  nations: z.array(z.enum(["eng", "sco", "wal", "ni"])),
});
const Batch = z.strictObject({ items: z.array(Verdict) });
export type TriageRow = Omit<z.infer<typeof Verdict>, "i"> & { url: string; title: string };

const SYSTEM = `You sort UK web pages for Beacon, which finds help people are entitled to.
For each numbered page decide "support": true only if the page describes something a person or household can get: a payment, grant, discount, free service, loan, tax relief, National Insurance credit, priority register, concession, compensation or unclaimed money. Pages about duties, fines, applications for licences, reporting, paying tax, or general rules are false.
For support pages give: a short "name" for the help (no "eligible"), "kind", the "provider" group (central = UK government bodies like DWP and HMRC; devolved = Scottish, Welsh or NI government; councils = councils and housing; nhs; schools = schools, colleges, student finance; utilities; charities; employ = employers and unions; banks; unclaimed = lost money; legal = courts, legal aid, ombudsmen), the "people" groups it mainly serves, and the "nations" it applies in (empty if unclear).
For other pages use name "", kind null, provider null, people [], nations [].`;

const SCHEMA = z.toJSONSchema(Batch);

async function loadPages(dir: string): Promise<{ url: string; title: string; description: string }[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json") && !["status.json", "triage.json"].includes(f));
  const all = await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), "utf8")) as { pages?: { url: string; title: string; description?: string }[] }));
  const seen = new Map<string, { url: string; title: string; description: string }>();
  for (const p of all.flatMap((x) => x.pages ?? [])) seen.set(p.url, { url: p.url, title: p.title, description: p.description ?? "" });
  return [...seen.values()];
}

export interface TriageProgress {
  running: boolean;
  total: number;
  done: number;
  support: number;
  failedBatches: number;
}
export const progress: TriageProgress = { running: false, total: 0, done: 0, support: 0, failedBatches: 0 };

export async function triage(root: string, { batchSize = 40, parallel = 4 } = {}): Promise<TriageProgress> {
  const dir = path.join(root, "catalog/harvest");
  const file = path.join(dir, "triage.json");
  const kept: Record<string, TriageRow> = JSON.parse(await readFile(file, "utf8").catch(() => "{}"));
  const todo = (await loadPages(dir)).filter((p) => !kept[p.url]);
  Object.assign(progress, { running: true, total: todo.length, done: 0, support: Object.values(kept).filter((r) => r.support).length, failedBatches: 0 });
  // Batches finish in any order; chain the writes so the file is never written twice at once.
  let writing = Promise.resolve();
  const persist = () => (writing = writing.then(() => writeFile(file, `${JSON.stringify(kept, null, 1)}\n`)));
  const batches = Array.from({ length: Math.ceil(todo.length / batchSize) }, (_, k) => todo.slice(k * batchSize, (k + 1) * batchSize));

  await mapLimit(batches, parallel, async (batch) => {
    try {
      const { message } = await chat({
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: batch.map((p, i) => `${i}. ${p.title} - ${p.description}`).join("\n") },
        ],
        schema: { name: "triage", schema: SCHEMA },
        effort: "low",
        maxTokens: 6000,
        cacheKey: "beacon-triage-v1",
      });
      const out = Batch.parse(JSON.parse(message.content ?? "{}"));
      for (const v of out.items) {
        const page = batch[v.i];
        if (!page) continue;
        const { i: _i, ...rest } = v;
        kept[page.url] = { url: page.url, title: page.title, ...rest };
        if (v.support) progress.support++;
      }
    } catch (e) {
      progress.failedBatches++;
      console.warn(JSON.stringify({ evt: "triage_batch_failed", size: batch.length, error: (e as Error).message }));
    }
    progress.done += batch.length;
    await persist();
  });
  progress.running = false;
  return progress;
}
