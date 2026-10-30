# Impeccable: design stages wired into our workflow

Impeccable (https://impeccable.style/docs/) is a design skill + detector. It is enabled for this project via
`.claude/settings.json` (`extraKnownMarketplaces.impeccable` + `enabledPlugins["impeccable@impeccable"]`): accept
the plugin install on first session, then run the one-time setup below. Commands run as `/impeccable <command> <target>`;
always **name the page** (e.g. `/impeccable audit the billing settings`) so it picks the right mode
(Persuade · Operate · Read · Experience).

## Where things live
| What | Where | Owner |
| --- | --- | --- |
| Product truth (audience, goals, platform, constraints) | `PRODUCT.md` (repo root, shared) | `/impeccable init`, which interviews you; never invent it |
| Visual system (tokens, type, components, rules) | `apps/web/DESIGN.md`: tokens GENERATED from `globals.css` by `design-tokens.py`; prose refined by `document` | `pnpm design:sync` owns tokens; `/impeccable document` may only enrich prose, then run `pnpm design:sync` |
| Per-page brief and direction | `.impeccable/surfaces/<page>.md` | `shape`, `impeccable` |
| Detector + hook config (shared, committed) | `.impeccable/config.json` | `impeccable hooks …` / `impeccable ignores …` CLI only, never hand-edit |
| Personal overrides | `.impeccable/config.local.json` (gitignored) | `--local` flag |
| Automatic checks | plugin hooks: PostToolUse (per edit) + Stop (deep pass) | `/impeccable hooks on/off/status` |
| CI gate | `pnpm design:check` (= `impeccable detect apps/web/src`, inside `pnpm check`) | exit 2 on findings fails CI |

Vendored code is excluded from detection: `ui/*`, `_preview*`, `apps/web/src/hooks/use-mobile.ts`. Record intentional exceptions narrowly:
`pnpm exec impeccable ignores add-value <rule> <value> --reason "…"`.

## Runs automatically (no manual invocation)
| When | What runs | Mechanism |
| --- | --- | --- |
| Every edit to UI code | Impeccable detector (immediate rules) | plugin PostToolUse hook |
| End of every turn | Detector deep pass on touched UI files | plugin Stop hook |
| UI request detected | Claude is told to run shape → build → harden/polish → audit | `design-gate.sh` (UserPromptSubmit) |
| End of a request that changed UI | Claude must run `audit` → fix → `harden` + `polish` → `pnpm design:check` before finishing (once per request) | `design-gate.sh` (Stop) |
| Session start with missing context | Claude is told to run `init` / `document` | `design-gate.sh` (SessionStart) |
| Every PR / push | `pnpm design:check` inside `pnpm check` | CI |
Turn the gate off for a session with `CLAUDE_DESIGN_GATE=0`.

## One-time setup (Claude prompts for it automatically)
1. `/impeccable init`: answer the interview, which writes `PRODUCT.md`.
2. `/impeccable document` from `apps/web`: enriches DESIGN.md prose and writes design.json. Tokens stay generated, so run `pnpm design:sync` afterwards.
3. `/impeccable doctor`: confirms hooks and context are healthy.

## Stages → our workflow
| Our step | Impeccable stage | Commands | Use when |
| --- | --- | --- | --- |
| **Plan** (`/plan`, ux-states matrix) | Create | `shape` (design brief), `impeccable` (describe the outcome) | Any new page, flow, or redesign. Put the brief in the plan |
| **Build** (design-system skill, catalog) | Create / System | `impeccable` (build), `generate` (compare variants of one element), `live` (iterate in the browser) | Implementing. Compose from `ui/*`, then the catalog, then custom |
| **Refine** (during build) | Refine | `layout` hierarchy · `typeset` text · `colorize` states · `animate` purposeful motion · `bolder` / `quieter` presence · `delight` key moments · `overdrive` showpieces only | A page works but feels flat, noisy, or generic |
| **Simplify** | Simplify | `distill` remove clutter · `clarify` copy and next steps · `adapt` other screens and devices | Dense screens, confusing states, responsive work |
| **Harden** (ux-states matrix) | Harden | `harden` errors, empty, offline, bad data · `onboard` first-run · `optimize` performance · `polish` finish | Before a PR. Verifies every state in the matrix |
| **Review** (`/review`) | Evaluate | `audit` (implementation problems, prioritized) · `critique` (what holds the design back) · `pnpm design:check` | Before merging UI. Attach the audit summary to the PR |
| **Maintain** | System | `document` (refresh DESIGN.md after visual changes) · `extract` (repeated UI → shared components) · `doctor` (stale context) | After design-system changes; when patterns repeat 3+ times |

## Rules that tie it to our design system
- Impeccable proposes; our design system decides: compose from `ui/*` and the catalog, use theme tokens only, and keep the preset fonts.
- `extract` output goes into `apps/web/src/components/` (shared) and never into vendored `ui/*`.
- Keep `DESIGN.md` in sync with the preset: re-run `document` after changing tokens, fonts, or components.
- `overdrive` and heavy effects belong only on marketing surfaces (Persuade), never on Operate screens.
