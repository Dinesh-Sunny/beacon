<!-- last-verified: 2026-10-03 -->
# Knowledge base (cold tier)

Deep, task-specific knowledge. Nothing here loads automatically: Claude reads a doc when a task needs it, and hot files point here with one-line pointers.

## Rules
- One topic per file: `docs/knowledge/<topic>.md`, kebab-case.
- Start each file with `# Title`, a one-line summary, and `last-verified:`.
- Prose is allowed here; size budget only (see `.claude/context.config.json`).
- Outdated docs move to `docs/knowledge/archive/` with the date; they are never silently deleted.

## Index
<!-- /docs-garden keeps this list in sync with the registry. -->
- [stack-fit.md](stack-fit.md): built and planned stack checked against current versions; blockers, holds, caveats per phase
- [auth.md](auth.md): Better Auth for app users, plugins, session rules, sidecar tokens
- [agent-ready.md](agent-ready.md): Markdown pages and llms.txt for agents, BotID on costly routes, AI referral tracking
- [compliance.md](compliance.md): UK GDPR rights in code: audit log, data export, erasure across services, retention
- [consent.md](consent.md): c15t consent banner, self-hosted records, GA4 and PostHog gating
- [observability.md](observability.md): Sentry errors, PostHog analytics and consent seam, Axiom log drain, secret scrubbing
- [ai.md](ai.md): AI agents on LangGraph and AI Gateway, AG-UI chat, adding agents and tools, limits
- [jobs.md](jobs.md): Payload jobs queue on one cron, tasks, retries, schedules, run-twice safety
- [payments.md](payments.md): organization subscriptions, Stripe plans by lookup key, tax, direct debits, plan limits
- [commerce.md](commerce.md): shop backend: Stripe Checkout adapter, webhook-driven orders, per-tenant shop settings, going live
- [rate-limits.md](rate-limits.md): Upstash rate limits for auth and the consent API, local Redis, fail-open rules
- [email.md](email.md): SES mailer, React Email templates, dev transport and previews, SES setup
- [database.md](database.md): Postgres wiring, env vars, pooler rules, migrations, provisioning
- [document-data.md](document-data.md): NoSQL-style jsonb documents on Postgres, query helpers, indexes, validation, when to use Redis or queues instead
- [graph.md](graph.md): graphs on Postgres: edge tables, recursive traversal, ltree trees, time-ranged edges, what's unavailable
- [payload.md](payload.md): Payload CMS features, version status, fit with current and planned stack
- [commerce-options.md](commerce-options.md): Medusa vs Payload ecommerce feature matrix, runtime, cost, recommendation
- [cost-model.md](cost-model.md): monthly cost of the stack at 100k DAU, usage model, cost levers
- [template-modules.md](template-modules.md): built-in modules, site archetypes, agent-ready defaults
