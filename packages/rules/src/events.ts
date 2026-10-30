// The stream the check sends to the browser (newline-delimited JSON over /api/check).
// Shared by the agent (producer) and the web app (consumer).

import type { Finding } from "./finding.ts";
import type { Precheck } from "./precheck.ts";
import type { SchemeId } from "./schemes.ts";

/** "default" when the endpoint refused a reasoning effort and the model used its own */
export type Effort = "low" | "medium" | "high" | "default";

export type CheckEvent =
  /** Hard rules settled in code, before any reading */
  | { type: "precheck"; items: Precheck[] }
  /** The plan: which kinds of support Beacon will read */
  | { type: "plan"; schemes: SchemeId[] }
  /** One page being read (one row in the Reading plan) */
  | {
      type: "reading";
      scheme: SchemeId;
      status: "reading" | "done" | "failed";
      title?: string;
      url?: string;
      /** True when the live page couldn't be read and Beacon's dated saved copy was used */
      snapshot?: boolean;
    }
  /** A settled finding (quote already verified in code) */
  | { type: "finding"; finding: Finding }
  /** Tokens used by one model step, for "How Beacon worked this out" */
  | {
      type: "usage";
      step: "judge" | "explain";
      effort: Effort;
      inputTokens: number;
      outputTokens: number;
      scheme?: SchemeId;
    }
  | { type: "done"; findings: Finding[]; model: string; snapshot: boolean }
  | { type: "error"; message: string };
