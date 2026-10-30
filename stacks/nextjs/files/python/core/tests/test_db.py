import os

import pytest

from __PYNAME___core.db import (
    APPLICATION_NAME,
    DATABASE_URL_ENV,
    DATABASE_URL_UNPOOLED_ENV,
    DatabaseConfigError,
    create_pool,
    database_url,
    ping,
)

LOCAL_URL = "postgresql://user:pass@localhost:5432/app"

# Integration tests need a real Postgres (`pnpm db:up`). CI provides one, so they never skip there.
requires_database = pytest.mark.skipif(
    not os.environ.get(DATABASE_URL_ENV), reason=f"{DATABASE_URL_ENV} not set"
)


def test_database_url_returns_pooled_url_when_not_direct() -> None:
    env = {DATABASE_URL_ENV: LOCAL_URL, DATABASE_URL_UNPOOLED_ENV: "postgresql://direct"}
    assert database_url(env) == LOCAL_URL


def test_database_url_returns_direct_url_when_direct() -> None:
    env = {DATABASE_URL_ENV: LOCAL_URL, DATABASE_URL_UNPOOLED_ENV: "postgresql://direct"}
    assert database_url(env, direct=True) == "postgresql://direct"


def test_database_url_raises_when_missing() -> None:
    with pytest.raises(DatabaseConfigError, match=DATABASE_URL_UNPOOLED_ENV):
        database_url({}, direct=True)


@requires_database
@pytest.mark.anyio
async def test_ping_succeeds_when_database_is_reachable() -> None:
    pool = create_pool(database_url())
    await pool.open(wait=True)
    try:
        await ping(pool)
    finally:
        await pool.close()


@requires_database
@pytest.mark.anyio
async def test_pool_connections_are_pgbouncer_safe_when_checked_out() -> None:
    pool = create_pool(database_url())
    await pool.open(wait=True)
    try:
        async with pool.connection() as conn:
            assert conn.prepare_threshold is None
            assert conn.autocommit is True
            row = await (await conn.execute("select 1 as one")).fetchone()
            assert row == {"one": 1}
    finally:
        await pool.close()


@requires_database
@pytest.mark.anyio
async def test_pool_connections_carry_application_name_when_checked_out() -> None:
    pool = create_pool(database_url())
    await pool.open(wait=True)
    try:
        async with pool.connection() as conn:
            row = await (
                await conn.execute("select current_setting('application_name') as name")
            ).fetchone()
            assert row == {"name": APPLICATION_NAME}
    finally:
        await pool.close()
