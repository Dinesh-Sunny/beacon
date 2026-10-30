<!--
  AGENTS.md: CANONICAL, tool-neutral project instructions. Single source of truth.
  Generated from this file (never edit those): GEMINI.md, .github/copilot-instructions.md, context-pack.md.
  Rules: <=120 lines, one fact per bullet, <=30 words per bullet, no derivable facts.
-->

# Beacon

Find the support that's already yours: a private agent on Beam that reads the official rules, shows what may be yours with the exact rule line, and does the safe steps.

## Stack

- Language: TypeScript 7, Node 22.18+ (type stripping, no build step for packages)
- Framework: Next.js 16 App Router, React 19
- Package manager: pnpm 12 workspaces (never mix lockfiles)
- Agent: Deep Agents on LangGraph, model Beam 1.0 through an OpenAI-compatible endpoint (HF router by default)
- Styling / UI: Tailwind 4, shadcn (radix), tokens from the Figma file "Beacon - UX & Design System"
- Testing: node:test (rules, brain), Playwright (web)
- Hosting: Hugging Face Space (Docker); evals and rules snapshot as Hub datasets

## Commands

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Dev server | `pnpm dev` (http://localhost:7860) |
| Build | `pnpm build` |
| Lint / format | `pnpm lint` / `pnpm format` (Biome) |
| Type-check | `pnpm typecheck` |
| Test | `pnpm test` |
| Rules snapshot | `pnpm snapshot` (reads GOV.UK, writes `packages/rules/snapshot/`) |
| Evals | `pnpm eval` (needs `HF_TOKEN`) |

Before calling a task done, run lint, type-check and tests for the areas you touched.

## Architecture

- Layout: `apps/web` (Next app, `/api/check` stream, `/api/mcp`), `packages/rules` (questions, schemes, age lines, pre-check, quote checker, GOV.UK reader), `packages/brain` (agent on Beam, evals).
- Data flow: answers (bands only), `precheck` settles hard rules in code, agent reads open schemes' GOV.UK pages, `record_finding` tool, `settleFinding` verifies the quote, stream to UI.
- A Likely needs a verified quote; code downgrades anything else to Worth checking.
- Anonymous checks store nothing on the server; answers live in the browser (state + link fragment).
- External services: GOV.UK Content API, postcodes.io, Beam endpoint, LangSmith (optional, inputs never logged).
- Stream contract: `packages/rules/src/events.ts` (`CheckEvent`), newline-delimited JSON.
- Copy follows `VOICE.md`. Design source: Figma file `BoqfTuFaLElMzRR85xViC6` and vault notes `Hackathons/Build with Beam 2026`.

## Conventions

- Read existing code before writing; follow nearby patterns, naming, and structure.
- Every rule number, date and age edge lives in `packages/rules/src/config.ts` with its source link.
- Never ask or store name, full address, NI number, bank details, exact amounts or full date of birth.
- Questions show only when the answer can still change a result (`skipReason` in `questions.ts`).
- User-facing copy: plain English, "you" voice, regular hyphens, no "eligible", no "AI", warm and positive.
- Packages are plain `.ts` with erasable syntax only (no enums, parameter properties or namespaces).
- Verify library APIs against current docs, not memory.

## Workflow

- One branch per change: `feat|fix|chore|docs/<slug>`. Conventional Commits. No AI credit lines in commits.
- Never commit secrets, `.env*`, or build output.

## Do not

- Edit generated files: `GEMINI.md`, `context-pack*.md`, `.github/copilot-instructions.md`, `.cursor/rules/`.
- Let the model's verdict reach the person without `settleFinding`.
- Disable lint rules, type checks, or tests to make something pass.

## Environment

- Required env var names are in `apps/web/.env.example`. Never read or print secret values.

## Knowledge upkeep

- Record new lessons in `.claude/inbox.md` (one line each); never append to this file directly.
