<!-- last-verified: 2026-10-01 -->
<!--
  Rule with no `paths:` frontmatter: loads at session start, like CLAUDE.md.
  Docs: https://code.claude.com/docs/en/memory#organize-rules-with-claude/rules/
-->
# Code style

- Match the style of the file you are editing before applying any rule below.
- TS: camelCase vars/functions, PascalCase types and components, SCREAMING_SNAKE constants. Python: PEP 8 naming (ruff `N`).
- TS exports: named exports, except where Next.js requires default (`page`, `layout`, `route` files).
- Imports: alias `@/*` in apps; workspace packages as `@__NAME__/<name>`; Biome and ruff own import order.
- Functions: small, single-purpose; early returns over nested conditionals.
- Types: TS strict with no `any`; Python fully typed for mypy strict. Explicit types at module boundaries.
- Errors: never swallow them; handle at boundaries with typed errors.
- Constants and config live in one module per package. No magic numbers or strings inline.
- Comments explain *why*. Delete commented-out code.
- Formatting is owned by Biome (JS/TS) and ruff (Python); the PostToolUse hook runs them.
