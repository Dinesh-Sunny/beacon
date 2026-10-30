---
name: design-system
description: Our UI design system (shadcn/ui preset b4XwA3eDL6 + free animated libraries like Animate UI, Magic UI, Aceternity, React Bits). Use BEFORE planning or building any UI - pages, forms, dialogs, tables, charts, empty states - to cover all states and flows and reuse the best components.
when_to_use: Any new screen, component, layout, or visual change in apps/web; "design", "build a page", "add a form", "make a dashboard".
paths:
  - "apps/web/src/**/*.tsx"
---
<!-- last-verified: 2026-10-03 -->
# Design system: shadcn preset b4XwA3eDL6

Preset: style **vega**, base **radix**, theme **violet**, base color **mauve**, charts **emerald**, headings **Merriweather**, body **Inter**, icons **Hugeicons**, pointer cursor.
Source of truth: https://ui.shadcn.com/create?preset=b4XwA3eDL6&base=radix&pointer=true (pages 01 and 02, bottom-right switcher)

## Before designing (planning)
Stage map and commands: [impeccable.md](impeccable.md) (Plan → Build → Refine → Simplify → Harden → Review → Maintain).
Run Impeccable stages yourself on every UI task; never wait for the user to ask. The design gate hook enforces it.
1. `/impeccable shape <page>` for the brief, then map every state, flow, and condition with [ux-states.md](ux-states.md); both go in the plan.
2. Find the closest composition in [patterns.md](patterns.md); see it live at http://localhost:3000/design (`pnpm dev`).
3. Look up richer animated versions in the LOCAL catalog first: [catalog/README.md](catalog/README.md) → open the category file
   (1,278 free items, 15 categories). Call the registry only to `view`/`add` chosen items. Library rules: [libraries.md](libraries.md).
4. Decide per element: our `ui/*` component → free library item → build it ourselves (always for Pro/paid items).

## Implementing
- Compose from `apps/web/src/components/ui/`. Need another base component? `pnpm dlx shadcn@latest add <name>` from `apps/web`.
- Library items: `--dry-run` first, never `--overwrite`, adapt to our tokens, icons, and fonts, and respect reduced motion.
- Refine with `/impeccable layout|typeset|colorize|animate …` as needed, then `harden` and `polish` before the PR.
- Before calling it done: run `/impeccable critique` and `audit` on the named pages, verify every matrix state live, measure alignment and heights with `getBoundingClientRect`, and keep `pnpm design:check` clean.

## Internal only
- The /design page is a team reference, never published: it 404s in production builds (set `ENABLE_DESIGN_PAGE=1` only for a private preview) and is marked `noindex`.
- Never link to /design from product UI, and never import from `_preview*` folders in product code. Copy the pattern instead.

## Tokens: globals.css ⇄ DESIGN.md mirror
- `apps/web/src/app/globals.css` is the single source; `apps/web/DESIGN.md` frontmatter and its GENERATED blocks mirror it (`design-tokens.py`).
- Editing globals.css regenerates DESIGN.md automatically. Hand-editing DESIGN.md tokens is blocked; only prose is editable.
- `pnpm design:tokens` (in `pnpm check` and CI) fails on drift or on any hardcoded design value. Exception: `design-allow: <reason>` comment.

## Rules
- Only shadcn components from `@/components/ui/*`. No hand-rolled buttons, inputs, dialogs, cards, or tables.
- Colors only via theme tokens (`bg-primary`, `text-muted-foreground`, `border`, `chart-1..5`). No hex, rgb, or arbitrary color values.
- Reserve `primary` for the next action; decorative surfaces stay quieter than the CTA beside them.
- Headings use `font-heading` (CardTitle already does); body text inherits Inter.
- Icons: `<HugeiconsIcon icon={X} strokeWidth={2} />` with `X` from `@hugeicons/core-free-icons`.
- Forms: `Field`, `FieldLabel`, `FieldDescription` + inputs. Empty states: `Empty`. Lists of rows: `Item`. Data: `Table`. Charts: `ChartContainer`.
- Cards follow Card → CardHeader (CardTitle, CardDescription) → CardContent → CardFooter, as in the reference.
- `components/ui/` is vendored: don't edit it. Update with `shadcn add <name> --overwrite`, then re-apply the local patches listed in [patterns.md](patterns.md).

## Refresh the reference (after shadcn updates the preset)
```bash
gh repo clone shadcn-ui/ui "$TMPDIR/gh-clones-$CLAUDE_SESSION_ID/ui" -- --depth 1 --filter=blob:none --sparse
git -C "$TMPDIR/gh-clones-$CLAUDE_SESSION_ID/ui" sparse-checkout set apps/v4/registry/bases/radix/blocks/preview apps/v4/registry/bases/radix/blocks/preview-02
python3 ${CLAUDE_SKILL_DIR}/scripts/port-preview.py "$TMPDIR/gh-clones-$CLAUDE_SESSION_ID/ui" "$CLAUDE_PROJECT_DIR"
```
Then run `pnpm check` and compare the /design page with the source URL above.
