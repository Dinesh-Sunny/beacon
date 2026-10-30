# {{PROJECT_NAME}}

<!-- Created from claude-project-template. Replace this README with the project's own once it starts. -->

Project starter with a full Claude Code setup and a self-maintaining AI-context system. It's for anyone starting a new project from this template, and for whoever maintains the template.

## Start a new project
Recommended (local, with the playbook). It copies this template and applies the Next.js stack:
```bash
~/CodeProjects/ai-playbook/bin/new-project.sh ~/CodeProjects/<name> --stack nextjs --name <name>
```
- Start Docker first. Setup then installs pnpm + uv deps, starts Postgres/Redis, runs migrations and `pnpm check`. Without Docker it stops at lint + typecheck.
- Drop `--stack nextjs` for a stack-neutral project (Claude Code setup only).
- The script copies from your local checkout (`~/CodeProjects/claude-project-template`, or `$AI_TEMPLATE_DIR`). It pulls `main` first only when that checkout is clean, so keep it on `main` with nothing uncommitted.

GitHub alternative (also creates the repo; the stack is a second step):
```bash
gh repo create <name> --private --template Dinesh-Sunny/claude-project-template --clone
cd <name> && ./stacks/nextjs/setup.sh . --name <name>
```

## Stack profiles
`nextjs` is the full agency base: Next.js 16 + shadcn/ui, Payload CMS, Better Auth, Postgres (Drizzle), Stripe, email, rate limits, consent, multi-tenancy, a Python AI sidecar (FastAPI + LangGraph), the design system with `apps/web/DESIGN.md`, and CI. Versions come from the captured lockfiles. See [stacks/](stacks/).

## First steps
1. Fill the stubs: `grep -rn "{{" AGENTS.md .claude/rules` (stack, commands, architecture).
2. Write `PRODUCT.md` and `VOICE.md`. With the `nextjs` stack, put secrets in `apps/web/.env.local`.
3. Health check: `python3 .claude/scripts/ctx.py check`
4. Build with `/feature <request>`. Capture lessons with `/learn`, and curate weekly with `/docs-garden`.

## What's inside
| Path | Purpose |
| --- | --- |
| `AGENTS.md` | Canonical, tool-neutral instructions (Codex, Cursor and Copilot read it natively) |
| `CLAUDE.md` | Thin Claude layer: `@AGENTS.md` + Claude-only guidance |
| `.claude/` | rules, skills, agents, hooks, workflows, templates, `ctx.py` context engine, settings |
| `.claude/context.config.json` | Context budgets and style limits |
| `.claude/skills/feature/`, `.claude/stacks/` | `/feature` pipeline: sized plans, per-stack experts, debate, approval gate. Also the stack registry and shared doc outlines |
| `docs/knowledge/` | Cold-tier knowledge base |
| `.github/`, `.cursor/`, `GEMINI.md`, `context-pack.md` | Generated adapters for other AI tools (`ctx.py sync`) |
| `stacks/` | Stack profiles (`nextjs`); applied once, then removed from the project |
| `.playbook-managed` | Shared machinery synced with the template via `ai-playbook/bin/playbook-sync.sh` |

## Evolving the template
- **Machinery** (rules, skills, hooks, `ctx.py`): improve it in any project, then `ai-playbook/bin/playbook-sync.sh push <project>`, and PR this repo. Projects pull updates with `playbook-sync.sh pull <project>`.
- **The `nextjs` stack** (code, versions, upgrades): change `~/CodeProjects/agency` first, then re-capture it here. Steps are in [stacks/README.md](stacks/README.md#evolve-a-profile).
