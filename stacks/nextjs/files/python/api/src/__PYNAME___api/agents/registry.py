"""Agents the API serves, by the name in `/v1/agents/{name}`.

Built per run: the model carries a credential that can expire (Vercel OIDC tokens last hours),
and building is cheap next to the model calls.
"""

from collections.abc import Callable
from typing import Any, Final

from ag_ui_langgraph import LangGraphAgent
from langchain_core.language_models import BaseChatModel
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph.state import CompiledStateGraph

from __PYNAME___api.agents import demo

type GraphBuilder = Callable[
    [BaseCheckpointSaver[Any], BaseChatModel], CompiledStateGraph[Any, Any, Any, Any]
]

AGENT_BUILDERS: Final[dict[str, GraphBuilder]] = {
    "demo": demo.build,
}


def is_known_agent(name: str) -> bool:
    return name in AGENT_BUILDERS


def build_agent(
    name: str, checkpointer: BaseCheckpointSaver[Any], model: BaseChatModel
) -> LangGraphAgent:
    # No raw events: they copy LangGraph internals (system prompt, provider metadata, usage)
    # onto the wire.
    return LangGraphAgent(
        name=name, graph=AGENT_BUILDERS[name](checkpointer, model), emit_raw_events=False
    )
