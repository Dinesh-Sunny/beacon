"""Postgres connection pool for Python services.

Mirrors packages/db: same env vars, same pooler rules. See docs/knowledge/database.md.
"""

import os
from collections.abc import Mapping
from typing import Any, Final

from psycopg import AsyncConnection
from psycopg.rows import DictRow, dict_row
from psycopg_pool import AsyncConnectionPool

# Names match what Neon's Vercel integration injects. Pooled (PgBouncer, transaction mode) for
# queries; direct for migrations, LangGraph `setup()`, and anything needing a real session.
DATABASE_URL_ENV: Final = "DATABASE_URL"
DATABASE_URL_UNPOOLED_ENV: Final = "DATABASE_URL_UNPOOLED"

POOL_NAME: Final = "__NAME__"
POOL_MIN_SIZE: Final = 1
POOL_MAX_SIZE: Final = 10
# Same values as packages/db: close spare connections fast (Fluid Compute suspends idle
# instances) and fail fast when the database is unreachable instead of hanging callers.
POOL_MAX_IDLE_SECONDS: Final = 5.0
POOL_TIMEOUT_SECONDS: Final = 5.0
CONNECT_TIMEOUT_SECONDS: Final = 5
# Recycle hourly like packages/db (PlanetScale wants lifetimes under 24 h; recycling also picks up
# changed role defaults such as the timeouts from migration 0014). psycopg_pool's default, made
# explicit so the two stacks can't drift.
POOL_MAX_LIFETIME_SECONDS: Final = 3600.0
# Shows in pg_stat_activity and query stats; one of the few startup parameters PgBouncer accepts.
APPLICATION_NAME: Final = "__NAME__-api"

# autocommit + dict_row: what LangGraph's Postgres checkpointer and store expect.
# prepare_threshold=None: never server-side prepare, so PgBouncer transaction mode is always safe.
CONNECTION_KWARGS: Final[Mapping[str, Any]] = {
    "autocommit": True,
    "row_factory": dict_row,
    "prepare_threshold": None,
    "connect_timeout": CONNECT_TIMEOUT_SECONDS,
    "application_name": APPLICATION_NAME,
}

type DictConnection = AsyncConnection[DictRow]
type DictPool = AsyncConnectionPool[DictConnection]


class DatabaseConfigError(RuntimeError):
    """Raised when the database URL is missing."""


def database_url(env: Mapping[str, str] = os.environ, *, direct: bool = False) -> str:
    """Return the pooled URL, or the direct one when ``direct`` is set."""
    name = DATABASE_URL_UNPOOLED_ENV if direct else DATABASE_URL_ENV
    value = env.get(name)
    if not value:
        raise DatabaseConfigError(f"{name} is not set. See docs/knowledge/database.md")
    return value


def is_database_configured(env: Mapping[str, str] = os.environ) -> bool:
    return bool(env.get(DATABASE_URL_ENV))


def create_pool(conninfo: str) -> DictPool:
    """Build an unopened pool; call ``await pool.open()`` at startup (FastAPI lifespan)."""
    return AsyncConnectionPool(
        conninfo,
        # The parameterized class itself (not the `type` alias) so psycopg can instantiate it.
        connection_class=AsyncConnection[DictRow],
        kwargs=dict(CONNECTION_KWARGS),
        min_size=POOL_MIN_SIZE,
        max_size=POOL_MAX_SIZE,
        max_idle=POOL_MAX_IDLE_SECONDS,
        max_lifetime=POOL_MAX_LIFETIME_SECONDS,
        timeout=POOL_TIMEOUT_SECONDS,
        # Connections can die while an instance is suspended or the server restarts.
        check=AsyncConnectionPool.check_connection,
        name=POOL_NAME,
        open=False,
    )


async def ping(pool: DictPool) -> None:
    """Run a trivial query; raises if the database is unreachable."""
    async with pool.connection() as conn:
        await conn.execute("select 1")
