import "server-only";
import { createHash } from "node:crypto";

// A small in-process LRU with a time limit. Model answers that depend only on the rules and a
// few bucketed inputs (call notes, banners) are reused, so the same question never costs tokens
// twice on one instance. Keys are hashes: nothing personal is kept in readable form.
// At scale this sits behind a shared store (Redis or Vercel Runtime Cache) with the same keys.

interface Entry<T> {
  value: T;
  expires: number;
}

export class Lru<T> {
  private map = new Map<string, Entry<T>>();
  hits = 0;
  misses = 0;
  constructor(
    private max: number,
    private ttlMs: number,
  ) {}

  get(key: string): T | undefined {
    const e = this.map.get(key);
    if (!e || e.expires < Date.now()) {
      if (e) this.map.delete(key);
      this.misses += 1;
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, e);
    this.hits += 1;
    return e.value;
  }

  set(key: string, value: T): void {
    if (this.map.size >= this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
  }

  get size() {
    return this.map.size;
  }
}

/** Stable hash of any JSON-safe value (keys sorted). */
export function keyOf(parts: unknown): string {
  const stable = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(stable)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v as object)
              .sort()
              .map((k) => [k, stable((v as Record<string, unknown>)[k])]),
          )
        : v;
  return createHash("sha256").update(JSON.stringify(stable(parts))).digest("base64url");
}

/** Runs `make` once per key; concurrent callers for the same key share one model call. */
export async function cached<T>(cache: Lru<T>, inflight: Map<string, Promise<T>>, key: string, make: () => Promise<T>): Promise<{ value: T; hit: boolean }> {
  const have = cache.get(key);
  if (have !== undefined) return { value: have, hit: true };
  const running = inflight.get(key);
  if (running) return { value: await running, hit: true };
  const p = make();
  inflight.set(key, p);
  try {
    const value = await p;
    cache.set(key, value);
    return { value, hit: false };
  } finally {
    inflight.delete(key);
  }
}
