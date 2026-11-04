# Beacon architecture: built to scale

This page is for engineers and judges who want to know how Beacon stays fast, cheap and correct as it grows from one check to millions a month.

## The framework in one picture

People who need help sit on the left (older people, disabled people, carers, families, people out of work, helpers checking for someone). Everyone who gives help sits on the right (UK government, councils, NHS, charities, utilities, employers, unclaimed money). Beacon sits in the middle: its agents connect a person to every provider that can help, and the same eight steps run for everyone - Understand, Match, Warn, Act, then Confirm, Receive, Keep, Watch.

Both sides grow independently. New people arrive through new channels (chat, voice, letters, advisers, partners). New help arrives as new rule packs (a council, a charity fund, a country). The middle stays the same.

## Principles

1. **Code decides, models explain.** Every result comes from a deterministic rules engine. Models read messy input (speech, letters, free text), call tools, and write explanations. Same answers, same result, no model drift in decisions.
2. **The check runs in the browser.** The rules engine and the question planner are plain TypeScript that runs client-side. A full check costs the server nothing. Servers are only touched when someone asks a model for help. This is the main reason Beacon can serve millions cheaply.
3. **Rules are data, not code.** Schemes, screening lines and clash notes live in versioned rule packs (`packs/uk-core.json`), validated by a zod schema on load, with every line citing its source. Adding a council, a charity fund or a country is a new pack, not a code change. Packs are small and cacheable at the edge.
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
| Health (`/api/health`) | Serverless | Uptime checks |

## Growing from here

- **Shared cache.** The in-process cache keeps the same keys when it moves to a shared store (Redis or a runtime cache), so hits work across every instance.
- **More packs.** Council packs layer on the core pack in a fixed order (core, country, nation, council). Each pack carries a version and a checked date, and old versions stay so past answers can be explained.
- **Rule extraction.** The watch already flags changed pages. Next, a model drafts the rule diff for the changed page as a pull request, and golden test households must pass before it merges.
- **Durable journeys.** Confirm, Receive, Keep and Watch need long-running workflows (weeks, not seconds). They run as durable background jobs with the person's consent, triggered by events, never by a page view.
- **Cells.** At very large scale, copies of the stack run per country for data residency, and a failure in one stays in one.
