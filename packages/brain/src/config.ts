// Single source of truth for the brain: where Beam lives, how hard it thinks per step, and how much
// one check may spend. Beam is served OpenAI-compatible, so Fireworks, Baseten or a self-hosted vLLM
// work by changing env only.

import { z } from "zod";

// HF Inference Providers router (https://huggingface.co/docs/inference-providers). Without a
// `:provider` / `:fastest` / `:cheapest` suffix the router picks the fastest provider.
export const BEAM_DEFAULTS = {
  baseUrl: "https://router.huggingface.co/v1",
  model: "reflection/Beam-1.0-501B-A23B",
} as const;

export const BEAM_ENV = {
  baseUrl: "BEAM_BASE_URL",
  model: "BEAM_MODEL",
  apiKey: "BEAM_API_KEY",
  hfToken: "HF_TOKEN",
} as const;

const EnvSchema = z.object({
  BEAM_BASE_URL: z.url().default(BEAM_DEFAULTS.baseUrl),
  BEAM_MODEL: z.string().min(1).default(BEAM_DEFAULTS.model),
  BEAM_API_KEY: z.string().min(1).optional(),
  HF_TOKEN: z.string().min(1).optional(),
});

export interface BeamEnv {
  baseUrl: string;
  model: string;
  /** BEAM_API_KEY wins over HF_TOKEN; undefined means the model cannot be reached */
  apiKey: string | undefined;
}

/** Reads env when called (never at import), so the package loads without a key. */
export function loadBeamEnv(
  env: Record<string, string | undefined> = process.env,
): BeamEnv {
  // Empty strings from .env files count as unset.
  const clean = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== undefined && v !== ""),
  );
  const parsed = EnvSchema.parse(clean);
  return {
    baseUrl: parsed.BEAM_BASE_URL,
    model: parsed.BEAM_MODEL,
    apiKey: parsed.BEAM_API_KEY ?? parsed.HF_TOKEN,
  };
}

// Beam accepts low / medium / high / xhigh / max (default medium). The stream contract reports
// only low / medium / high, so steps stay within those.
// Which schemes to read is settled in code (precheck), so the model only judges and explains.
export type Step = "judge" | "explain";
export const EFFORT = {
  judge: "high",
  explain: "medium",
} as const satisfies Record<Step, "low" | "medium" | "high">;

// Output budget per call, reasoning included (Beam always reasons). The model card's eval guide
// uses 16384 for short tasks.
export const MAX_OUTPUT_TOKENS = {
  judge: 16_384,
  explain: 8_192,
} as const satisfies Record<Step, number>;

// Sampling from the model card's EVALUATION.md (temperature 0.7, top_p 0.99).
export const SAMPLING = { temperature: 0.7, topP: 0.99 } as const;

export const LIMITS = {
  /** Read one page, maybe a second look, then record: anything past this is a loop */
  modelCallsPerScheme: 4,
  modelCallsPerCheck: 30,
  /** Input plus output tokens across every model call in one check */
  tokensPerCheck: 400_000,
  /** Rule readers running at once, to stay inside provider rate limits */
  parallelReaders: 5,
  /** Per model call, before the client gives up */
  callTimeoutMs: 120_000,
  retries: 1,
  /** LangGraph steps for one reader (each model call plus each tool call is a step) */
  readerRecursionLimit: 20,
  /** Longest pasted letter Beacon reads, in characters (a few pages) */
  letterChars: 8_000,
} as const;

/** Where each scheme's page sits in a rule reader's filesystem. */
export const RULES_DIR = "/rules/";
export const rulesFile = (scheme: string): string => `${RULES_DIR}${scheme}.md`;

/** Lines a reader is told to read at once (deepagents read_file defaults to 100). */
export const READ_LINES = 400;

/** Snapshot folder override; defaults to packages/rules/snapshot. */
export const SNAPSHOT_DIR_ENV = "BEACON_SNAPSHOT_DIR";
