---
name: review-false-positive-traps
description: Things in this repo that look like bugs but are not, plus how to verify Next.js SEO/metadata changes cheaply; check before flagging context or metadata issues
metadata:
  type: project
---

- `.claude/inbox.md` entries tagged `[promoted YYYY-MM-DD]` were copied to the external AI playbook by `ctx.py promote`, NOT into `.claude/rules/*`. Don't flag "promoted but missing from rules".
- `ctx.py lint` warns on inbox line length/word count because it counts the whole line (src + target); warnings, not errors.
- Next metadata: run `pnpm build` in apps/web, then grep `.next/server/app/*.html` for canonical/robots/og:url and read `robots.txt.body` / `sitemap.xml.body`. Root-layout `alternates.canonical` leaks into every page that doesn't override it (seen on `_not-found`).
- `src/lib/site.ts` falls back to http://localhost:3000 when SITE_URL and Vercel vars are absent, and IS_INDEXABLE is true for any non-Vercel production build.

**Why:** first seen reviewing feat/next-config-seo (2026-10-02); verifying from build output beat reasoning about Next merge rules.
**How to apply:** for SEO/metadata diffs, build and read the emitted head tags before claiming a bug. See also [[hook-and-linter-pitfalls]].
- Vercel ALLOWS AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_REGION (not reserved; vercel.com/docs/environment-variables/reserved-environment-variables). Don't flag the SDK default chain.
- `outputFileTracingIncludes` keys use picomatch `contains: true`, so `"/*"` matches every route. Verify in `.next/server/app/**/*.nft.json`, not by reasoning.
- JS regex `^X=$` with the `m` flag matches before `\r` too (`\r` is a line terminator), so CRLF `.env` files are not a bug for line-anchored replaces. Verified 2026-10-03.
- rtk rewrites `pnpm exec biome ...` output into a fake "1 errors / ERR_PNPM" summary. Rerun with `rtk proxy ./node_modules/.bin/biome check <files>` before reporting lint failures.
