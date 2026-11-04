// One polite HTTP client for every harvester: a few requests at a time per host, a pause
// between them, retries with backoff on 429 and 5xx, and an honest User-Agent. Connectors
// never call fetch directly, so rate limits and caching are decided in one place.

const UA =
  "Beacon knowledge harvester (+https://github.com/Dinesh-Sunny/beacon)";

export interface FetcherOptions {
  perHost?: number;
  gapMs?: number;
  retries?: number;
}

export function createFetcher({
  perHost = 3,
  gapMs = 250,
  retries = 3,
}: FetcherOptions = {}) {
  const queues = new Map<string, { active: number; waiting: (() => void)[] }>();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function slot(host: string): Promise<() => void> {
    const q = queues.get(host) ?? { active: 0, waiting: [] };
    queues.set(host, q);
    if (q.active >= perHost) await new Promise<void>((r) => q.waiting.push(r));
    q.active++;
    return () => {
      setTimeout(() => {
        q.active--;
        q.waiting.shift()?.();
      }, gapMs);
    };
  }

  return async function politeFetch(
    url: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const release = await slot(new URL(url).host);
    try {
      for (let attempt = 0; ; attempt++) {
        const res = await fetch(url, {
          ...init,
          headers: { "User-Agent": UA, ...init.headers },
          signal: AbortSignal.timeout(20_000),
        });
        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          const wait =
            Number(res.headers.get("retry-after")) * 1000 ||
            1000 * 2 ** attempt;
          await sleep(wait);
          continue;
        }
        return res;
      }
    } finally {
      release();
    }
  };
}

export type PoliteFetch = ReturnType<typeof createFetcher>;

/** Runs `fn` over items with at most `n` in flight. */
export async function mapLimit<T, R>(
  items: T[],
  n: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k] as T);
      }
    }),
  );
  return out;
}
