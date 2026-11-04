// Every language's words, with English underneath so a missing key reads in English rather
// than as a key name.
import type { Locale } from "../locales";
import en from "./en.json";

export type Messages = typeof en;

const OTHERS: Partial<Record<Locale, unknown>> = {};

function merge<T>(base: T, over: unknown): T {
  if (!over || typeof over !== "object" || typeof base !== "object" || !base)
    return (typeof over === typeof base ? over : base) as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>))
    out[k] = k in out ? merge(out[k], v) : v;
  return out as T;
}

export const MESSAGES = Object.fromEntries(
  (["en", "cy", "pl", "es", "bn", "ur", "ar"] as const).map((l) => [
    l,
    merge(en, OTHERS[l]),
  ]),
) as Record<Locale, Messages>;
