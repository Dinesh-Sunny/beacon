---
name: hook-and-linter-pitfalls
description: Recurring defects in .claude/hooks gate scripts and the regex-based UI linters (voice-check.py, design-tokens.py); check these first when reviewing hook/linter changes
metadata:
  type: project
---

Recurring defect classes seen in hook gates and per-line regex linters (first seen reviewing feat/copywriting-skill, 2026-10-01).

- Slash-command detection via unanchored `grep "/<skill>"` on the whole prompt fires on any prompt that mentions the skill's path.
- Stateful Stop gates (`.claude/logs/<gate>/<session>.*`) that never clear the marker after blocking re-block on every later turn. design-gate.sh does it right: it resets per request and keeps a `.gated` marker.
- A gate that only clears on the PostToolUse(Skill) event misses user-typed `/skill` invocations, which never go through the Skill tool.
- `Path(rel).match("a/**/*.tsx")` does not recurse. `**` acts as one segment, so hook mode silently skips nested routes. Use `full_match` (3.13+) or a regex.
- Per-line regex prose extraction misses multi-line JSX text, which Biome wraps, and template literals. `"/*" in line` inside a string literal disables the linter for the rest of the file.

**Why:** these failures are silent (a false "ok" or a nag loop), so the tests pass and nobody notices.
**How to apply:** when a review touches .claude/hooks/* or a *-check.py linter, run it on crafted fixtures in the scratchpad: a nested path, multi-line JSX, a `"/api/*"` string, a multi-turn hook simulation.
- voice-check.py UI_GLOBS only covers `*.tsx`. Copy kept in `.ts` modules (e.g. emails/auth-copy.ts) is never scanned, and "voice: ok" is a false pass. Seen feat/email.
