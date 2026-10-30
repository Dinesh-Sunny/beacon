import {
  type LimitResult,
  type LimitRule,
  retryAfterSeconds,
  windowMs,
} from "./rule.ts";

// Bounds memory if a flood of distinct keys arrives while Upstash is down: past this, expired
// windows are dropped, and if that isn't enough the whole map starts over.
const MAX_KEYS = 10_000;

const windows = new Map<string, { count: number; resetAt: number }>();

function prune(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
  if (windows.size >= MAX_KEYS) windows.clear();
}

// Same fixed-window rule as the Upstash script, counted in this instance only.
export function consumeInMemory(
  scope: string,
  key: string,
  rule: LimitRule,
  now: number = Date.now(),
): LimitResult {
  const id = `${scope}:${key}`;
  let window = windows.get(id);
  if (!window || window.resetAt <= now) {
    if (windows.size >= MAX_KEYS) prune(now);
    window = { count: 0, resetAt: now + windowMs(rule) };
    windows.set(id, window);
  }
  window.count += 1;
  return window.count <= rule.max
    ? { allowed: true, retryAfterSeconds: null }
    : {
        allowed: false,
        retryAfterSeconds: retryAfterSeconds(window.resetAt - now),
      };
}
