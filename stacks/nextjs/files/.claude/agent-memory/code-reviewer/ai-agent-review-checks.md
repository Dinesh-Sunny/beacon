---
name: ai-agent-review-checks
description: Verified ag_ui_langgraph 0.0.46 / langgraph-checkpoint-postgres 3.1.2 / langfuse 4.x / Vercel OIDC traps; check before approving any python/api agent, AG-UI proxy, or AI Gateway change
metadata:
  type: project
---

First seen reviewing feat/ai-backend (2026-10-03).

- `LangGraphAgent(emit_raw_events=True)` is the default: every LangGraph event (system prompt, ls_model_name, provider response_metadata) streams to the browser as RAW and as `raw_event` on other events. Pass `emit_raw_events=False`.
- ag_ui_langgraph `prepare_stream`: `stream_input = {**forwarded_props, **payload_input}`; `input.state` and client `messages` (system/assistant/tool roles) merge into graph state. Never derive identity or authz from graph state.
- `forwarded_props.node_name` drives `aupdate_state(as_node=...)` on the caller's thread; resume via `input.resume` or `forwardedProps.command.resume`.
- AsyncPostgresSaver `_cursor` holds `self.lock` (one asyncio.Lock) even with a pool, so checkpoint I/O is serialized per process. It also captures `asyncio.get_running_loop()` at construction.
- Langfuse `get_client().flush()` is sync (`force_flush` plus queue joins); calling it in an async path blocks the event loop.
- Vercel OIDC: in Functions the token comes in the `x-vercel-oidc-token` request header, NOT a runtime env var (vercel.com/docs/oidc); env exists only in builds/`vercel env pull`. TTL 2 h, so don't bake it into cached models.
- @ag-ui/client `onRunFinalized` fires in rxjs finalize, after the HTTP stream closes. Any post-run server work (titles) delays it and keeps the composer busy.

**Why:** all of these pass unit tests; they only show up on the wire, under concurrency, or in a deployed environment.
**How to apply:** grep the installed `.venv/.../ag_ui_langgraph/agent.py` and the Vercel docs before signing off. See [[observability-review-checks]], [[ratelimit-review-checks]].
