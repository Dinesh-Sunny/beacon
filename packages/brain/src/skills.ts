// How to judge each scheme (src/skills/<scheme>/SKILL.md). Each rule reader handles one scheme, so
// its skill goes straight into its system prompt: opening it through the deepagents skills tool
// would cost one more Beam call per scheme for a file the reader always needs.
// apps/web must trace these files into its server bundle (outputFileTracingIncludes).

import { readFileSync } from "node:fs";
import type { SchemeId } from "@beacon/rules";

const cache = new Map<SchemeId, string>();

/** The skill body without its frontmatter. */
export function schemeSkill(scheme: SchemeId): string {
  const hit = cache.get(scheme);
  if (hit !== undefined) return hit;
  const raw = readFileSync(
    new URL(`./skills/${scheme}/SKILL.md`, import.meta.url),
    "utf8",
  );
  const body = raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
  cache.set(scheme, body);
  return body;
}
