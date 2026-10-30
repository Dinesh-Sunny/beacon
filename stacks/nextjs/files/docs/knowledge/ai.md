<!-- last-verified: 2026-10-03 -->
# AI agents

How the template runs AI agents: LangGraph in the private Python service, models through Vercel AI Gateway, AG-UI to an assistant-ui chat in the account area. Read before adding an agent, a tool, or a chat surface.

## Pieces

| Piece | Where | Notes |
| --- | --- | --- |
| Models | `python/core/src/__PYNAME___core/ai.py` | `main_model()` (Sonnet 5.5), `fast_model()` (Haiku 4.5), both on AI Gateway with OpenAI fallbacks |
| Agents | `python/api/src/__PYNAME___api/agents/` | `registry.py` maps a name to a graph builder; `demo.py` is the read-only example |
| Run endpoint | `POST /v1/agents/{name}` (sidecar) | AG-UI events over SSE, behind the service-token check |
| History | `GET /v1/agents/{name}/threads/{id}/messages` | messages from LangGraph state, owner only |
| Proxy | `apps/web/src/lib/agent-proxy.ts`, `/api/agents/[agent]` | session, per-user rate limit, 15-minute service token, allowlist (`apps/web/src/lib/agents.ts`) |
| State | `checkpoint*` tables (migration 0009), `agent_threads` (owner, agent, title, last use) | `pnpm db:migrate` creates both; LangGraph's `setup()` never runs |
| UI | `/account/assistant`, `apps/web/src/components/assistant/AssistantChat.tsx` | assistant-ui (`apps/web/src/components/assistant-ui/`, vendored; Lucide names mapped to Hugeicons in `icons.tsx`) |
| Tracing | `python/api/src/__PYNAME___api/agents/tracing.py` | Langfuse Cloud when `LANGFUSE_*` keys are set |
| Retention | `agent-threads-cleanup` (daily job) | whole threads idle 90 days, plus state whose owner was deleted |

## Adding an agent

1. `python/api/src/__PYNAME___api/agents/<name>.py` with `build(checkpointer)` returning a compiled graph (`langchain.agents.create_agent` or a `StateGraph`).
2. Register it in `AGENT_BUILDERS`, and add the name to `AGENTS` in `apps/web/src/lib/agents.ts` (the proxy refuses anything else).
3. Point a chat at `/api/agents/<name>` (see `AssistantChat`).

## Adding a tool

- Tools that read or write our data take the user from `run_context()`, never from tool arguments or graph state: the model and the browser can send anything, and AG-UI merges client input into graph state (the sidecar drops client `state` and `forwardedProps`, and accepts only one new user message per run).
- Read-only by default. A tool that changes data needs an explicit confirmation step (AG-UI interrupt) and its own permission check.
- Keep results small: they go back into the model's context and into checkpoints.

## Environment

- `AI_GATEWAY_API_KEY` wins when set. On Vercel, functions get the deployment's OIDC token per request in the `x-vercel-oidc-token` header (not as an env var at runtime); the web proxy forwards it to the sidecar, which builds models per run because the token expires. Locally `vercel env pull` puts a ~12-hour `VERCEL_OIDC_TOKEN` in the env file. AI Gateway also needs a card on the Vercel team. Neither credential: the page shows "not set up" and the sidecar answers 503.
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL` (EU default) turn tracing on.
- Local: `pnpm dev` and `pnpm dev:py` together.

## Rules and limits

- Python AI packages are pre-1.0: exact pins in `python/*/pyproject.toml`; upgrade deliberately and re-run the agent tests.
- Checkpoint tables mirror LangGraph's DDL. After upgrading `langgraph-checkpoint-postgres`, compare `BasePostgresSaver.MIGRATIONS` and add a migration for new steps.
- The checkpointer uses our pool (`prepare_threshold=None`); never `from_conn_string` (it prepares statements, which the pooler rejects).
- A run is one function invocation on each side: 300 s on Hobby, 800 s on Pro. Longer work needs a resume driver (planned: Vercel Workflow or Queues resuming from the checkpoint).
- Thread ids are UUIDs from the page, claimed on first use; another user's id looks like a missing thread.
- Limits per run: 512 KB request (proxy), one new user message of at most 8,000 characters, 200 messages, 2,048 output tokens; runs and history reads share the 20-per-minute per-user limit.
- Raw LangGraph events are off (`emit_raw_events=False`): they'd send the system prompt and provider metadata to the browser. Run errors reach the browser as a plain message; details stay in the server log.
- Titles run alongside the reply and wait at most 5 s after it (Haiku, no retries); a failed or slow title never breaks the reply.
- The Langfuse flush runs in a thread: it's blocking network I/O.
- `AsyncPostgresSaver` serialises checkpoint I/O with one lock per process, so the pool adds no checkpoint concurrency.
- Deleting a user cascades to `agent_threads`; their checkpoints (which can hold tool output like names and emails) go in the next daily sweep, within 24 hours. The sweep deletes checkpoint state with no `agent_threads` row, so every LangGraph use must register its threads.
- Local patches to vendored assistant-ui files (re-apply after re-installing them): `thread.aui.tsx` shows the attachment button only when an attachments adapter is set; Lucide imports point at `apps/web/src/components/assistant-ui/icons.tsx`.
- `@assistant-ui/react-ag-ui` 0.0.63 pins `@ag-ui/client` 0.0.59; keep ours on the same version (the Python side speaks AG-UI 1.0).
