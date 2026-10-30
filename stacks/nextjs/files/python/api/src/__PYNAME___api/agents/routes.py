"""Agent endpoints: run an agent (AG-UI over server-sent events) and read a conversation back.
Private like the rest of the API; every call carries the web app's service token."""

import asyncio
import logging
import uuid
from collections.abc import AsyncIterator
from typing import Annotated, Any, Final

from ag_ui.core.events import BaseEvent, EventType, RunErrorEvent
from ag_ui.core.types import RunAgentInput
from ag_ui.encoder import EventEncoder
from ag_ui_langgraph.utils import langchain_messages_to_agui
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from __PYNAME___api.agents.context import AgentRunContext, bind_run_context
from __PYNAME___api.agents.input import RunInputError, new_user_text, sanitize_run_input
from __PYNAME___api.agents.models import ChatModels, chat_models
from __PYNAME___api.agents.registry import build_agent, is_known_agent
from __PYNAME___api.agents.threads import (
    claim_thread,
    owns_thread,
    set_thread_title,
    thread_needs_title,
)
from __PYNAME___api.agents.titles import title_for
from __PYNAME___api.agents.tracing import traced_run, tracing_callbacks
from __PYNAME___api.security import current_user
from __PYNAME___core.ai import VERCEL_OIDC_HEADER, gateway_credential
from __PYNAME___core.auth import ServiceTokenClaims
from __PYNAME___core.db import DictPool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/agents")

# What the browser sees when a run fails; the provider's message (billing links, model ids,
# request details) goes to the server log and Sentry only.
RUN_ERROR_MESSAGE: Final = "The assistant couldn't answer just now. Try again in a moment."
# A title waits this long after the reply; past it the thread keeps no title for now.
TITLE_WAIT_SECONDS: Final = 5.0

type User = Annotated[ServiceTokenClaims, Depends(current_user)]


def public_event(event: BaseEvent) -> BaseEvent:
    if isinstance(event, RunErrorEvent):
        logger.error("agent run failed: %s", event.message)
        return RunErrorEvent(type=EventType.RUN_ERROR, message=RUN_ERROR_MESSAGE)
    return event


def parse_thread_id(value: str) -> str:
    """Thread ids are UUIDs (the page makes them); anything else is refused before the database."""
    try:
        return str(uuid.UUID(value))
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid thread id") from None


def run_dependencies(request: Request, agent_name: str) -> tuple[DictPool, AsyncPostgresSaver, str]:
    """The pool, checkpointer and model credential a run needs, or the reason it can't run."""
    if not is_known_agent(agent_name):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown agent")
    pool: DictPool | None = getattr(request.app.state, "db_pool", None)
    checkpointer: AsyncPostgresSaver | None = getattr(request.app.state, "checkpointer", None)
    credential = gateway_credential(request.headers.get(VERCEL_OIDC_HEADER))
    if pool is None or checkpointer is None or credential is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI is not configured")
    return pool, checkpointer, credential


async def saved_messages(agent: Any, thread_id: str) -> list[Any]:
    snapshot = await agent.graph.aget_state({"configurable": {"thread_id": thread_id}})
    values = snapshot.values or {}
    messages: list[Any] = values.get("messages", [])
    return messages


@router.post("/{agent_name}")
async def run_agent(
    agent_name: str,
    body: RunAgentInput,
    request: Request,
    user: User,
    models: Annotated[ChatModels, Depends(chat_models)],
) -> StreamingResponse:
    """Runs an agent for the signed-in user and streams AG-UI events."""
    pool, checkpointer, credential = run_dependencies(request, agent_name)
    thread_id = parse_thread_id(body.thread_id)
    # Someone else's thread looks like a missing one: ids don't leak across users.
    if not await claim_thread(pool, thread_id, user.user_id, agent_name):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown thread")

    agent = build_agent(agent_name, checkpointer, models.main(credential))
    agent.config = {"callbacks": tracing_callbacks()}
    saved_ids = {str(message.id) for message in await saved_messages(agent, thread_id)}
    try:
        run_input = sanitize_run_input(body.model_copy(update={"thread_id": thread_id}), saved_ids)
    except RunInputError as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(error)) from None

    first_text = new_user_text(run_input, saved_ids)
    needs_title = first_text is not None and await thread_needs_title(pool, thread_id)
    encoder = EventEncoder(accept=request.headers.get("accept") or "")

    async def events() -> AsyncIterator[str]:
        bind_run_context(AgentRunContext(user_id=user.user_id, pool=pool))
        # Starts with the run, so the title is usually ready when the reply ends.
        title_task = (
            asyncio.create_task(title_for(first_text, models.fast(credential)))
            if needs_title and first_text
            else None
        )
        failed = False
        try:
            async with traced_run(agent=agent_name, user_id=user.user_id, thread_id=thread_id):
                async for event in agent.run(run_input):
                    failed = failed or isinstance(event, RunErrorEvent)
                    yield encoder.encode(public_event(event))
            if title_task and not failed:
                title = await asyncio.wait_for(title_task, TITLE_WAIT_SECONDS)
                await set_thread_title(pool, thread_id, title)
        except TimeoutError:
            logger.warning("thread title timed out")
        except Exception:
            # The reply has already streamed; a title failure must not break it.
            logger.exception("saving the thread title failed")
        finally:
            if title_task and not title_task.done():
                title_task.cancel()

    return StreamingResponse(events(), media_type=encoder.get_content_type())


@router.get("/{agent_name}/threads/{thread_id}/messages")
async def thread_messages(
    agent_name: str,
    thread_id: str,
    request: Request,
    user: User,
    models: Annotated[ChatModels, Depends(chat_models)],
) -> dict[str, list[dict[str, Any]]]:
    """A thread's messages in AG-UI form, read from its LangGraph state, for reopening it."""
    pool, checkpointer, credential = run_dependencies(request, agent_name)
    thread_id = parse_thread_id(thread_id)
    if not await owns_thread(pool, thread_id, user.user_id, agent_name):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown thread")
    # Reading state never calls the model; the graph just needs one to be built.
    agent = build_agent(agent_name, checkpointer, models.main(credential))
    return {
        "messages": [
            message.model_dump(by_alias=True, exclude_none=True)
            for message in langchain_messages_to_agui(await saved_messages(agent, thread_id))
        ]
    }
