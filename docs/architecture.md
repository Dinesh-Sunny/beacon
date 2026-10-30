# Beacon architecture

For developers working on Beacon and for anyone reviewing how it reaches an answer. Setup and usage live in the root `README.md`; decisions live in `docs/adr/`.

## The pieces

| Part | Where | Job |
| --- | --- | --- |
| Web app | `apps/web` | Next.js 16 App Router. The question flow, the results page, `/api/check` (the check stream) and `/api/mcp` (the same tools for other agents). |
| Rules | `packages/rules` | Everything that can be settled without judgement: the questions and when each is skipped, scheme catalogue, age lines, money lines (`config.ts`, each with its source link), `precheck`, the quote checker, the GOV.UK reader and the dated snapshot. |
| Brain | `packages/brain` | The agent on Beam (Deep Agents on LangGraph): read each open scheme, judge through `record_finding`, explain. The precheck in code picks what to read. Emits `CheckEvent`s. |
| Evals | `packages/evals` | BenefitsBench: 30 made-up situations, a deterministic test against `precheck`, and a runner that calls the agent at three effort levels. |

Packages are plain TypeScript run by Node's type stripping (erasable syntax only, no build step). Next compiles them for the app.

## One check, start to finish

1. **Answers.** The browser collects answers as bands (`Situation` in `situation.ts`). They live in page state and the link fragment only. `planSteps` decides which questions show; each skipped one carries a reason the answers rail can show ("Not needed - you get Pension Credit").
2. **Pre-check (code).** `precheck(situation, today)` returns one status per scheme: `already-get`, `ruled-out` (with a plain reason) or `open`. Hard rules only: age lines worked out from birth year (and month for 1960-61), nation, home type, the £16,000 caps, benefits that block or include others.
3. **Read.** Each open scheme's GOV.UK pages are fetched whole through the Content API (`readGovuk`), every guide part joined with its heading. If a live read fails, the snapshot in `packages/rules/snapshot/` is used and the result says so (`done.snapshot`).
4. **Judge (Beam, effort high).** Beam must call `record_finding` (`ProposedFindingSchema`): verdict, reason, exact quote, the answers it relied on, what's missing.
5. **Settle (code).** `settleFinding` runs `verifyQuote` against the page text. A Likely without a quote found word for word is downgraded to Worth checking. Nothing the model proposes reaches the person without this step.
6. **Stream.** Each stage is a newline-delimited JSON `CheckEvent` (`packages/rules/src/events.ts`): `precheck`, `plan`, `reading`, `finding`, `usage` (tokens per step and effort), `done`, `error`.
7. **Explain, on request (Beam, effort medium).** On a result page, "Help me with what to say" posts the settled finding to `/api/explain`, which returns next steps and a call script or letter written only from the scheme's claim details. Same rate limit as `/api/check`; nothing stored.

## Model access

The model client is OpenAI-compatible. By default it calls the Hugging Face router with `HF_TOKEN` and `reflection/Beam-1.0-501B-A23B`. Endpoint, model name and key can be overridden through environment variables (names in `apps/web/.env.example`), which is how an organisation points Beacon at its own vLLM server running Beam's open weights.

## Data and privacy

- No database. An anonymous check stores nothing on the server.
- Never asked: name, full address, NI number, bank details, exact amounts, full date of birth.
- Optional LangSmith tracing is configured to never log inputs.
- External calls: GOV.UK Content API (public pages), postcodes.io (postcode district to nation and council), the Beam endpoint.

## Reproducibility

- `RULES_AS_OF` in `config.ts` dates every money line. The snapshot manifest dates every page read.
- BenefitsBench fixes "today" per dataset (`asOf`), because age lines move with time.
- The Docker build refreshes the snapshot from GOV.UK and keeps the committed one when it can't.

## Hosting

A Docker Space on Hugging Face (`Dockerfile` at the root): Node 22, pnpm through corepack, `next start` on port 7860 as user 1000. Secrets (`HF_TOKEN`) are Space secrets, read at runtime.
