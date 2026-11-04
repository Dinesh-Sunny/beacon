# Beacon architecture: built to scale

This page is for engineers and judges who want to know how Beacon stays fast, cheap and correct as it grows from one check to millions a month.

## The framework in one picture

People who need help sit on the left (older people, disabled people, carers, families, people out of work, helpers checking for someone). Everyone who gives help sits on the right (UK government, councils, NHS, charities, utilities, employers, unclaimed money). Beacon sits in the middle: its agents connect a person to every provider that can help, and the same eight steps run for everyone - Understand, Match, Warn, Act, then Confirm, Receive, Keep, Watch.

Both sides grow independently. New people arrive through new channels (chat, voice, letters, advisers, partners). New help arrives as new rule packs (a council, a charity fund, a country). The middle stays the same.

## Principles

1. **Code decides, models explain.** Every result comes from a deterministic rules engine. Models read messy input (speech, letters, free text), call tools, and write explanations. Same answers, same result, no model drift in decisions.
2. **The check runs in the browser.** The rules engine and the question planner are plain TypeScript that runs client-side. A full check costs the server nothing. Servers are only touched when someone asks a model for help. This is the main reason Beacon can serve millions cheaply.
3. **Rules are data, not code.** Schemes, screening lines, clash notes and challenge routes live in versioned rule packs (`packs/*.json`, one per group of help: core benefits, bills, NHS costs, councils, families, Scotland, work and care, household and debt, unclaimed money). `RegistrySchema` in `src/engine/pack.ts` validates each pack, then checks every id, line, topic and reference across all of them before merging. Adding a group is a new JSON file, not a code change (`node scripts/check-packs.ts` validates it).
3a. **One source for every answer.** `src/engine/answers-schema.ts` defines what each answer can be. The Answers type, request validation, the fact ids packs may use and the model's tool schema (generated with `z.toJSONSchema`) all derive from it, so a new question is one edit plus its wording.
4. **Tokens are the scarce resource, so climb a cost ladder and stop early:**
   - precomputed copy (questions, reasons, warnings) costs nothing
   - the rules engine in the browser costs nothing
   - cached model answers (call notes per scheme and relevant answers, banners per mix of life areas) cost nothing after the first person
   - a model call only when judgement is needed, at low reasoning effort, with compact tool outputs instead of raw history
5. **Background work never touches the request path.** The knowledge watch runs daily in GitHub Actions, checks every official page behind the pack, and opens a pull request when one changes. Live checks keep running on the last good pack while the rules are updated.
6. **Untrusted text is quarantined.** Letters are read by a model that can only fill a fixed schema and can't take actions. Code validates every field and strips identifiers before anything is shown.
7. **Nothing personal on the server.** Answers live in the browser. API routes take what one request needs and keep nothing. Cache keys are hashes. Telemetry logs model, tokens and time only.
8. **Fail calm.** If a model is slow or down, the questions, rules and results keep working, and the person sees a warm note instead of an error.
9. **Every limit is explicit.** Per-IP rate limits, a daily cap, request size limits, model timeouts and token caps sit at the edge of every model route.

## What runs where

| Piece | Where | Scales with |
| --- | --- | --- |
| Rules engine, planner, claim order, clash notes | Browser | Free: the user's device |
| Rule pack | Static JSON, bundled and edge-cached | Free |
| Agent chat (`/api/chat`) | Serverless function, Muse Spark with tools | Only when someone chats |
| Letter reading (`/api/letter`) | Serverless, SAM 3.1 + Muse Spark in parallel | Only when someone adds a letter |
| Voice (`/api/voice`) | Serverless, Muse Voice Transcribe | Seconds of audio |
| Call notes (`/api/prepare`) | Serverless, cached per scheme + relevant answers | Unique situations, not users |
| Results banner (`/api/card`) | Serverless, cached per mix of life areas | 127 combinations at most |
| Knowledge watch | GitHub Actions, daily | Number of official pages |
| Harvest, triage, drafts | GitHub Actions weekly, or a dev route on a machine with web access | Number of source pages, each fetched and sent to a model once |
| Claim tracking and Watch | Browser (localStorage) | Free |
| Health (`/api/health`) | Serverless | Uptime checks |

## Bulk open data

Big registers come in as one download each, never page by page:

1. A connector in `src/knowledge/connectors/` downloads the file on a machine that can reach it (the dev route `POST /api/dev/harvest` or the weekly GitHub Action) and keeps a filtered raw copy, gzipped, in `catalog/harvest/raw/`.
2. A builder in `scripts/` turns the raw copy into an app file in `src/data/`. Changing what Beacon keeps means editing the builder and running it again, with no new download.
3. Large files stay on the server (`src/server/`) and the browser asks for just its slice by postcode: `/api/council` returns the council's own pages, `/api/charities` the grant-giving charities for that area.

| Dataset | Connector | Builder | Served by |
| --- | --- | --- | --- |
| Council service pages (GOV.UK Local Links Manager) | `councils` | `scripts/council-links.ts` | `/api/council` |
| Grant-giving charities (Charity Commission register) | `charitycommission` | `scripts/charity-funds.ts` | `/api/charities` |

## Next.js 16 features in use

| Feature | Where |
| --- | --- |
| Server Action with `cookies()` and `refresh()` | `src/i18n/actions.ts` switches language |
| `experimental.useOffline` + `useOffline` | `src/components/OfflineNotice.tsx`; Next retries navigations when back online |
| React `ViewTransition` + Link `transitionTypes` | `src/components/PageTransition.tsx`, forward into the check, back to the site |
| `typedRoutes` | every `href` is checked against real routes |
| `generateMetadata`, `metadataBase`, JSON-LD | pages, in the reader's language |
| `opengraph-image` with `next/og` `ImageResponse` | `src/app/opengraph-image.tsx`, drawn from live counts |
| `manifest`, `robots`, `sitemap` metadata routes | `src/app/` |
| `error`, `not-found`, `global-error`, `loading` | `src/app/`, `src/app/check/loading.tsx` |
| React Compiler | `reactCompiler: true` |

Not used, on purpose: `cacheComponents` / `use cache` (the language lives in a cookie, so every page renders per request and the static shell would be empty; the council lookups use an in-memory cache instead), and `next/font` (it can't split one family by unicode range, and Fontsource already self-hosts Fraunces and Atkinson with Latin Extended for Welsh and Polish).

## Growing from here

- **Shared cache.** The in-process cache keeps the same keys when it moves to a shared store (Redis or a runtime cache), so hits work across every instance.
- **More packs.** Council packs layer on the core pack in a fixed order (core, country, nation, council). Each pack carries a version and a checked date, and old versions stay so past answers can be explained.
- **Knowledge pipeline (live).** Connectors harvest aggregator sources (GOV.UK Content and Search APIs first: 1,279 pages in two minutes) through one polite fetcher. Each page's text is stored once in `catalog/sources/` with a hash index, so engine or UI changes never re-download. Muse Spark triages pages into help or not and tags them to the Framework's groups, then drafts rules in the engine's own language. `src/knowledge/review.ts` checks drafts with the live schema and quality gates (no model, no network) and ranks which new question would unlock the most drafts. Drafts reach a pack only after review. `catalog/coverage.json` maps every Framework group to what's live, next and where its data comes from; `scripts/coverage-page.ts` renders it.
- **Durable journeys.** Confirm, Receive and Watch run in the browser today: claim progress (applied, awarded, refused) with challenge routes from the packs, awards fed back so unlocked help is checked again, and a note of what's new when the packs grow. With consent, the same steps move to durable background jobs (reminders, deadlines, Keep) triggered by events, never by a page view.
- **Cells.** At very large scale, copies of the stack run per country for data residency, and a failure in one stays in one.
