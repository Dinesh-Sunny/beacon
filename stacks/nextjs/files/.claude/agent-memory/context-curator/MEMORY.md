# context-curator memory

<!--
  Persistent memory for the "context-curator" subagent (frontmatter: memory: project).
  Committed so the team shares what the agent learns. Claude Code loads the start of this file
  into the subagent's context, so keep it short. Use one line per entry and link detail files.
-->

## Recurring patterns
- UI lessons (Impeccable, colour emphasis) belong in `.claude/skills/design-system/SKILL.md`, not hot files.
- User corrections often already live in the user's auto-memory; cite them as gate evidence for inbox entries.
- Hardcoded counts in context (e.g. "40 installed") drift; drop them instead of re-counting.

## Known pitfalls
- `[promoted DATE]` in the inbox means "sent to playbook by `ctx.py promote`"; hand-marking it blocks the export.
- Inbox word limit counts the whole line (date, pipes, `src:`); keep the fact ≤18 words, drop `→ target` once placed.
- `ctx.py` flags backticked URL routes (account, admin, ingest paths) as missing slash commands: false positives.
- Stale-rule warnings: re-verify each bullet against code, then `ctx.py verify <file>`; check referenced paths exist.

## Detail files
- <!-- e.g. [auth-flows.md](auth-flows.md) -->
