"""Langfuse tracing for agent runs (Langfuse Cloud, OpenTelemetry-based SDK v4). Off unless both
keys are set. Traces carry the user and thread ids; Sentry keeps errors only."""

import asyncio
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any, Final

from langfuse import get_client, propagate_attributes
from langfuse.langchain import CallbackHandler

LANGFUSE_KEY_ENVS: Final = ("LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY")


def is_tracing_configured() -> bool:
    return all(os.environ.get(name) for name in LANGFUSE_KEY_ENVS)


def tracing_callbacks() -> list[Any]:
    return [CallbackHandler()] if is_tracing_configured() else []


@asynccontextmanager
async def traced_run(*, agent: str, user_id: str, thread_id: str) -> AsyncIterator[None]:
    """Groups a run's spans under the user and the thread (a Langfuse session), then flushes:
    a serverless instance can suspend right after the response. The flush blocks on network
    I/O, so it runs in a thread instead of stalling every other stream on this worker."""
    if not is_tracing_configured():
        yield
        return
    try:
        with propagate_attributes(user_id=user_id, session_id=thread_id, trace_name=agent):
            yield
    finally:
        await asyncio.to_thread(get_client().flush)
