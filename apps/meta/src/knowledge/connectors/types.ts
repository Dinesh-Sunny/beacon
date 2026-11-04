import type { PoliteFetch } from "../fetcher.ts";
import type { SnapshotResult } from "../sources.ts";

export interface HarvestContext {
  fetch: PoliteFetch;
  log: (line: string) => void;
  /** Writes a JSON file under catalog/harvest/. */
  save: (file: string, data: unknown) => Promise<void>;
  /** Keeps a text copy of each page in catalog/sources/, skipping pages already kept. */
  store: (urls: string[]) => Promise<SnapshotResult>;
}

export interface Connector {
  id: string;
  name: string;
  licence: string;
  run: (ctx: HarvestContext) => Promise<{ items: number }>;
}
