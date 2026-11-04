import "server-only";

// A small LRU with time-to-live for model answers that many people share. Call notes depend only
// on the scheme, the answers that scheme reads (bucketed), who the check is for and the pack
// version; the banner depends only on life areas. Similar people get the same answer without a
// second model call. Keys are hashed, values hold no raw answers, and entries expire.
//
// One instance per server process is enough for the demo. At scale the same interface sits on a
// shared store (Redis or a KV) without changing callers.

import { createHash } from "node:crypto";

interface Entry<V> {
  value: V;
  expires: number;
}

export class TtlLru<V> {
  private map = new Map<string, Entry<V>>();
  hits = 0;
  misses = 0;
  constructor(
    private readonly max: number,
    private readonly ttlMs: number,
  ) {}

  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e || e.expires < Date.now()) {
      if (e) this.map.delete(key);
      this.misses += 1;
      return undefined;
    }
    // Refresh recency.
    this.map.delete(key);
    this.map.set(key, e);
    this.hits += 1;
    return e.value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }
}

/** Stable key: a hash of the parts, so no answer is ever stored as plain text in a key. */
export function cacheKey(...parts: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("base64url").slice(0, 32);
}

/** Collapse a weekly amount into bands so near-identical answers share one cache entry. */
export function band(n: number | undefined, step: number): number | undefined {
  return n === undefined ? undefined : Math.round(n / step) * step;
}

const DAY = 24 * 60 * 60 * 1000;
export const notesCache = new TtlLru<unknown>(5_000, 7 * DAY);
export const bannerCache = new TtlLru<string>(64, 30 * DAY);
