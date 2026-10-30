"""Demo agent: proves the pipeline (auth, tools on our data, streaming, checkpoints) with
read-only tools. Client projects replace it with their own agents."""

from datetime import UTC, datetime
from typing import Any, Final

from langchain.agents import create_agent
from langchain_core.language_models import BaseChatModel
from langchain_core.tools import tool
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph.state import CompiledStateGraph

from __PYNAME___api.agents.context import run_context

SYSTEM_PROMPT: Final = (
    "You are the assistant in this app's account area. Answer plainly and briefly. "
    "Use the tools for facts about the signed-in person and their organizations; never guess "
    "them. You can only read: if asked to change something, say where in the account area it "
    "can be done."
)


@tool
async def my_account() -> dict[str, Any]:
    """The signed-in person's name and email, and each organization they belong to with
    their role in it."""
    context = run_context()
    async with context.pool.connection() as conn:
        user = await (
            await conn.execute(
                'select name, email from auth."user" where id = %s::uuid', (context.user_id,)
            )
        ).fetchone()
        organizations = await (
            await conn.execute(
                """select o.name, m.role from auth.member m
                     join auth.organization o on o.id = m.organization_id
                    where m.user_id = %s::uuid order by o.name""",
                (context.user_id,),
            )
        ).fetchall()
    return {
        "name": user["name"] if user else None,
        "email": user["email"] if user else None,
        "organizations": [{"name": row["name"], "role": row["role"]} for row in organizations],
    }


@tool
def current_time() -> str:
    """The current date and time in UTC, ISO 8601."""
    return datetime.now(UTC).isoformat(timespec="seconds")


def build(
    checkpointer: BaseCheckpointSaver[Any], model: BaseChatModel
) -> CompiledStateGraph[Any, Any, Any, Any]:
    return create_agent(
        model,
        [my_account, current_time],
        system_prompt=SYSTEM_PROMPT,
        checkpointer=checkpointer,
    )
