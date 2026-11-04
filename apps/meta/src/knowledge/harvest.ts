// Runs connectors and records progress in catalog/harvest/status.json, so a run started in the
// background (dev route or GitHub Actions) can be watched and resumed. Node only.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CONNECTORS } from "./connectors/index.ts";
import { createFetcher } from "./fetcher.ts";
import { snapshot } from "./sources.ts";

export interface HarvestStatus {
  running: boolean;
  started: string;
  finished: string | null;
  connectors: Record<string, { state: "waiting" | "running" | "done" | "failed"; items?: number; error?: string; log: string[] }>;
}

export async function harvest(root: string, only?: string[]): Promise<HarvestStatus> {
  const dir = path.join(root, "catalog/harvest");
  await mkdir(dir, { recursive: true });
  const list = CONNECTORS.filter((c) => !only?.length || only.includes(c.id));
  const status: HarvestStatus = {
    running: true,
    started: new Date().toISOString(),
    finished: null,
    connectors: Object.fromEntries(list.map((c) => [c.id, { state: "waiting" as const, log: [] }])),
  };
  const flush = () => writeFile(path.join(dir, "status.json"), `${JSON.stringify(status, null, 1)}\n`);
  await flush();
  const fetch = createFetcher();

  for (const c of list) {
    const st = status.connectors[c.id];
    if (!st) continue;
    st.state = "running";
    await flush();
    try {
      const r = await c.run({
        fetch,
        log: (line) => {
          st.log.push(line);
          void flush();
        },
        save: (file, data) => writeFile(path.join(dir, file), `${JSON.stringify(data, null, 1)}\n`),
        store: (urls) => snapshot(urls, { dir: path.join(root, "catalog/sources"), fetchFn: fetch }),
      });
      st.state = "done";
      st.items = r.items;
    } catch (e) {
      st.state = "failed";
      st.error = (e as Error).message;
    }
    await flush();
  }
  status.running = false;
  status.finished = new Date().toISOString();
  await flush();
  return status;
}
