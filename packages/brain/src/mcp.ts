// Plain functions behind Beacon's MCP server (apps/web mounts them at /api/mcp). Inputs are parsed
// here, at the boundary, with the exported schemas.

import {
  type CheckEvent,
  type Finding,
  type Precheck,
  SCHEMES,
  SituationSchema,
} from "@beacon/rules";
import { z } from "zod";
import { type CheckOptions, collectCheck } from "./check.ts";
import {
  GetRulesInput,
  loadRules,
  pageFileText,
  type ReadOptions,
} from "./tools.ts";

export const ListSchemesInput = z.object({});
export { GetRulesInput };
export const CheckEligibilityInput = z.object({ situation: SituationSchema });

export function listSchemes(_input: z.input<typeof ListSchemesInput> = {}) {
  return SCHEMES.map((s) => ({
    id: s.id,
    name: s.name,
    runBy: s.runBy,
    summary: s.summary,
    nations: s.nations,
    claim: s.claim,
  }));
}

export async function getRules(
  input: z.input<typeof GetRulesInput>,
  opts: ReadOptions = {},
) {
  const { scheme } = GetRulesInput.parse(input);
  const { page, snapshot } = await loadRules(scheme, opts);
  return {
    scheme,
    title: page.title,
    url: page.url,
    publicUpdatedAt: page.publicUpdatedAt,
    readAt: page.readAt,
    snapshot,
    text: pageFileText(page),
  };
}

export interface EligibilityResult {
  precheck: Precheck[];
  findings: Finding[];
  model?: string;
  snapshot?: boolean;
  error?: string;
}

/** Runs a full check and returns its result in one piece. */
export async function checkEligibility(
  input: z.input<typeof CheckEligibilityInput>,
  opts: Omit<CheckOptions, "signal"> & { signal?: AbortSignal } = {},
): Promise<EligibilityResult> {
  const { situation } = CheckEligibilityInput.parse(input);
  const events: CheckEvent[] = await collectCheck(situation, opts);
  const result: EligibilityResult = { precheck: [], findings: [] };
  for (const e of events) {
    if (e.type === "precheck") result.precheck = e.items;
    else if (e.type === "finding") result.findings.push(e.finding);
    else if (e.type === "done")
      Object.assign(result, {
        findings: e.findings,
        model: e.model,
        snapshot: e.snapshot,
      });
    else if (e.type === "error") result.error = e.message;
  }
  return result;
}
