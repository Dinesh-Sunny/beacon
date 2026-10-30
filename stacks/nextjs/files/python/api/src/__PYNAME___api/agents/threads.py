"""Thread ownership. The AG-UI client picks thread ids, so every run claims its thread first:
a new id becomes the caller's, an existing one must already be theirs."""

from __PYNAME___core.db import DictPool

# Insert or touch in one statement. The update only applies when the caller already owns the row,
# so a thread someone else owns returns nothing.
_CLAIM_SQL = """
insert into agent_threads (id, user_id, agent) values (%(id)s, %(user_id)s, %(agent)s)
on conflict (id) do update set updated_at = now()
  where agent_threads.user_id = excluded.user_id and agent_threads.agent = excluded.agent
returning id
"""


async def claim_thread(pool: DictPool, thread_id: str, user_id: str, agent: str) -> bool:
    async with pool.connection() as conn:
        row = await (
            await conn.execute(_CLAIM_SQL, {"id": thread_id, "user_id": user_id, "agent": agent})
        ).fetchone()
    return row is not None


async def owns_thread(pool: DictPool, thread_id: str, user_id: str, agent: str) -> bool:
    async with pool.connection() as conn:
        row = await (
            await conn.execute(
                """select 1 from agent_threads
                    where id = %s and user_id = %s::uuid and agent = %s""",
                (thread_id, user_id, agent),
            )
        ).fetchone()
    return row is not None


async def thread_needs_title(pool: DictPool, thread_id: str) -> bool:
    async with pool.connection() as conn:
        row = await (
            await conn.execute("select title from agent_threads where id = %s", (thread_id,))
        ).fetchone()
    return row is not None and row["title"] is None


async def set_thread_title(pool: DictPool, thread_id: str, title: str) -> None:
    async with pool.connection() as conn:
        await conn.execute(
            "update agent_threads set title = %s where id = %s and title is null",
            (title, thread_id),
        )
