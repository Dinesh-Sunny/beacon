export type LimitRule = { max: number; windowSeconds: number };

export type LimitResult = {
  allowed: boolean;
  retryAfterSeconds: number | null;
};

// Seconds until a blocked caller may retry, rounded up so clients never retry early.
export function retryAfterSeconds(ttlMs: number): number {
  return Math.max(1, Math.ceil(ttlMs / 1000));
}

// The window in whole milliseconds. A zero, negative, or fractional-below-1ms window would make
// the store's expiry fail after the count, so it is refused up front.
export function windowMs(rule: LimitRule): number {
  const ms = Math.ceil(rule.windowSeconds * 1000);
  if (!(ms > 0) || !(rule.max > 0)) {
    throw new RangeError(`Invalid rate limit rule: ${JSON.stringify(rule)}`);
  }
  return ms;
}
