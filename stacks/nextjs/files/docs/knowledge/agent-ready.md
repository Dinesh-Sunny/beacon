<!-- last-verified: 2026-10-03 -->
# Agent-ready defaults

How a client site serves AI agents and answer engines, and how it keeps bots off the routes that cost money or send email. Read before changing robots, structured data, Markdown output, or the routes BotID protects.

## What ships

| Piece | What it does | Code |
| --- | --- | --- |
| Markdown pages | Every published CMS page as Markdown at `/<slug>.md` (home: `/index.md`), and at the page URL itself when the request says `Accept: text/markdown`. `noindex`, `Vary: Accept`, with a canonical `Link` header to the HTML page; pages advertise it with `<link rel="alternate" type="text/markdown">`. Cached per page and purged on publish; editor text is escaped so it reads as on the page | `apps/web/src/lib/agent-markdown.ts`, route `apps/web/src/app/md/[[...slug]]/route.ts`, rewrites in `apps/web/next.config.ts` |
| llms.txt, llms-full.txt | Site name, description, and links to each page's Markdown; the full file inlines every page | `apps/web/src/lib/llms-txt.ts`, `apps/web/src/app/llms.txt/route.ts`, `apps/web/src/app/llms-full.txt/route.ts` |
| Structured data | WebSite and Organization on the home page, FAQPage from FAQ blocks | `apps/web/src/lib/structured-data.ts`, `apps/web/src/lib/json-ld.ts` |
| Crawlers | robots.txt allows every crawler, AI ones included, except private paths; previews and unconfigured hosts are `noindex` everywhere | `apps/web/src/app/robots.ts` |
| Vercel BotID | Invisible bot check on sign-up, sign-in, magic link, verification and reset emails, invitations, agent runs, and data export. Free Basic tier. Runs only on Vercel (`VERCEL` set; the browser side on `NEXT_PUBLIC_VERCEL_ENV`): `next dev`, `next start`, CI, and self-hosting skip it. A BotID error lets the request through and is logged | `apps/web/src/lib/bot-protection.ts`, `apps/web/src/lib/bot-protection-routes.ts`, `apps/web/src/instrumentation-client.ts`, `createAuth({ isBot })` |
| AI referrals | Sessions that arrive from ChatGPT, Perplexity, Claude, Gemini, Copilot and others carry `ai_referrer` on every PostHog event (after measurement consent) | `apps/web/src/lib/observability/ai-referrer.ts` |

## Rules

- Markdown and the HTML page come from the same published content (`getPublishedPage`), so they can't disagree. Adding a block: give it a Markdown case in `agent-markdown.ts` (the switch is exhaustive).
- The `Accept` rewrite for one-segment paths runs after app routes match (`afterFiles`), so sign-in, account, and API routes always answer in HTML or JSON. `/` rewrites to `/md/index`: a rewrite to the bare catch-all hands it `["md"]`.
- BotID: a path must be in `BOT_PROTECTED_ROUTES` for the browser to attach its headers, and the server checks only those paths; a server check on a path missing from the list always fails. Auth paths live in `BOT_CHECKED_AUTH_PATHS` (`@__NAME__/auth/config`). Server-side `auth.api` calls are never checked.
- Server checks go through `isBotRequest()` and run after the session check where there is one, so anonymous junk never costs a check (Deep Analysis bills per check).
- To test bot handling: run on a Vercel preview, or call `checkBotId({ developmentOptions: { bypass: "BAD-BOT" } })` temporarily under `next dev`.
- A CDN in front of Vercel must honour `Vary: Accept`, or HTML and Markdown for the same URL can be mixed up; Vercel's own routing applies the rewrite before its cache.
- To keep AI training crawlers out for a client, add `disallow` rules per user agent in `robots.ts` (GPTBot, ClaudeBot, Google-Extended, CCBot); answer engines (OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot) are what bring referrals.

## Not built (decided 2026-10-03)

- Public MCP endpoint, admin MCP for Payload, and OAuth for agents: not added to the base. Add per client when an agent integration is in scope (`mcp-handler`, `@payloadcms/plugin-mcp`, `@better-auth/oauth-provider`).
- BotID Deep Analysis (paid): turn on per project in the Vercel dashboard for the routes above if Basic isn't enough.

## Related

- Pages and blocks: docs/knowledge/payload.md · Analytics and consent: docs/knowledge/observability.md, docs/knowledge/consent.md
