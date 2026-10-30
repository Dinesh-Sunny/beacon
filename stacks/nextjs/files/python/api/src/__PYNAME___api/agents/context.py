"""Who a run is for. Tools read it instead of trusting anything the model or the browser sends.

Set at the start of each run inside the request's task; LangGraph runs tools in child tasks,
which inherit it.
"""

from contextvars import ContextVar
from dataclasses import dataclass

from __PYNAME___core.db import DictPool


@dataclass(frozen=True, slots=True)
class AgentRunContext:
    user_id: str
    pool: DictPool


_current: ContextVar[AgentRunContext] = ContextVar("agent_run_context")


def bind_run_context(context: AgentRunContext) -> None:
    _current.set(context)


def run_context() -> AgentRunContext:
    try:
        return _current.get()
    except LookupError:
        raise RuntimeError("Agent tool called outside an agent run") from None
