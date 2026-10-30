## Stack

- Monorepo: pnpm workspaces (JS/TS) + uv workspace (Python), one repo
- Node ≥24, pnpm 12 (pinned via `packageManager`); Python 3.14 (`.python-version`), uv
- Frontend: Next.js 16 App Router in `apps/web` (TypeScript strict, Tailwind 4, React Compiler)
- UI: shadcn/ui preset `b4XwA3eDL6` (radix, vega, violet), Hugeicons. Internal dev-only reference: the /design page (404 in production); new UI must reuse it
- JS/TS lint + format: Biome (root `biome.json`). Python: ruff (lint + format), mypy strict, pytest
- Services: see docs/adr/0001-stack.md. Database: Postgres 18 via Drizzle in `packages/db`, psycopg pool in `__PYNAME___core.db` (docs/knowledge/database.md)

## Commands

<!-- Root scripts in package.json are the source of truth; session start also injects them. -->
| Task | Command |
| --- | --- |
| First setup | `pnpm setup` (pnpm install + uv sync --all-packages) |
| Dev server (web) | `pnpm dev` |
| Python sidecar | `pnpm dev:py` (FastAPI on :8000, docs at /docs) · both via Vercel: `pnpm dev:all` |
| Lint / format | `pnpm lint` · `pnpm format` |
| Type-check | `pnpm typecheck` (next typegen + tsc, mypy) |
| Test | `pnpm test` (JS packages + pytest; DB tests need `pnpm db:up`) |
| Database | `pnpm db:up` · `pnpm db:generate` · `pnpm db:migrate` (Drizzle + Payload) · `pnpm db:studio` |
| CMS (Payload) | admin at localhost:3000/admin · `pnpm cms:migrate:create <name>` after schema changes · `pnpm --filter web cms:types` |
| Everything | `pnpm check` (lint → typecheck → test) |
| Build | `pnpm build` |
| One JS package | `pnpm --filter <name> <script>` |
| One Python member | `uv run --package <name> <cmd>` |
| Add a JS dependency | `pnpm --filter <name> add <dep>` (ask first) |
| Add a Python dependency | `uv add --package <name> <dep>` (ask first) |

Before calling a task done: `pnpm check` must pass.

## Architecture

- `apps/*`: deployable JS apps (pnpm). `apps/web` is the Next.js frontend; it has its own AGENTS.md with Next.js 16 guidance
- `packages/*`: shared JS/TS packages named `@__NAME__/<name>`, consumed with `workspace:*`
- `python/*`: uv workspace members (src layout, tests beside src). Cross-member deps use `{ workspace = true }`
- Next.js is the full-stack app. `python/api` is a PRIVATE FastAPI sidecar only for Python-only libraries
- App-user auth: Better Auth in `packages/auth` (`@__NAME__/auth`), server helpers in `apps/web/src/lib/session.ts` (docs/knowledge/auth.md)
- Email: `@__NAME__/email` mailer (SES, dev log locally), React Email templates in `apps/web/src/emails/` (docs/knowledge/email.md)
- Observability: Sentry (errors), PostHog (consent-gated analytics), Axiom (log drain); scrub secrets from URLs (docs/knowledge/observability.md)
- Consent: c15t banner, records in the `consent` schema; trackers load only after consent (docs/knowledge/consent.md)
- Payload CMS 3 runs inside `apps/web`: `(payload)` and `(frontend)` route groups, tables in the `payload` Postgres schema (docs/knowledge/payload.md)
- Next server code calls Python via `apps/web/src/lib/python-api.ts`; `vercel.json` services bind it as `BACKEND_INTERNAL_URL`
- Root holds shared tooling only: `package.json` scripts, `pnpm-workspace.yaml`, `pyproject.toml` (ruff/mypy/pytest), `biome.json`
- Design context: PRODUCT.md (product truth, via Impeccable) and `apps/web/DESIGN.md` (visual system, a generated mirror of `globals.css`)
- Copy context: `VOICE.md` (voice, tone, vocabulary, claims policy). All user-facing words follow it; `pnpm copy:check` enforces it
- Design values only from tokens; no hardcoded colors, sizes, or fonts. `pnpm design:tokens` enforces it
- UI work runs Impeccable automatically (shape → harden/polish → audit); a hook gates turns that change UI
- Deep dives live in `docs/knowledge/`. See its README index; load only what the task needs.
