"""FastAPI app. Private on Vercel: reachable only from the Next.js service through its binding."""

import logging
import re
from collections import Counter
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, Request, Response, status
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from __PYNAME___api.agents.routes import router as agents_router
from __PYNAME___api.models import Health, Me, Readiness, TextStatsRequest, TextStatsResponse
from __PYNAME___api.observability import init_sentry
from __PYNAME___api.security import current_user
from __PYNAME___core.auth import ServiceTokenClaims, verifier_from_env
from __PYNAME___core.db import DictPool, create_pool, database_url, is_database_configured, ping

logger = logging.getLogger(__name__)

# Before the app exists, so the FastAPI integration instruments it.
init_sentry()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # The pool opens in the background, so a database outage doesn't block startup;
    # /health/ready reports it instead.
    pool: DictPool | None = create_pool(database_url()) if is_database_configured() else None
    app.state.db_pool = pool
    # Tables come from `pnpm db:migrate` (packages/db), so setup() never runs here.
    app.state.checkpointer = AsyncPostgresSaver(conn=pool) if pool is not None else None
    app.state.token_verifier = verifier_from_env()
    if pool is not None:
        await pool.open()
    try:
        yield
    finally:
        app.state.db_pool = None
        app.state.checkpointer = None
        app.state.token_verifier = None
        if pool is not None:
            await pool.close()


app = FastAPI(title="__NAME__-api", docs_url="/docs", redoc_url=None, lifespan=lifespan)

TOP_WORDS_LIMIT = 5


@app.get("/health")
def health() -> Health:
    return Health(status="ok")


@app.get("/health/ready")
async def ready(request: Request, response: Response) -> Readiness:
    pool: DictPool | None = getattr(request.app.state, "db_pool", None)
    if pool is None:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return Readiness(status="degraded", db="unconfigured")
    try:
        await ping(pool)
    except Exception:
        # Details can name hosts: log them, return only up/down.
        logger.exception("database readiness check failed")
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return Readiness(status="degraded", db="down")
    return Readiness(status="ok", db="ok")


@app.get("/v1/me")
def me(user: Annotated[ServiceTokenClaims, Depends(current_user)]) -> Me:
    # Example of a user-scoped endpoint: the web app forwards a short-lived service token.
    return Me(user_id=user.user_id, email=user.email)


@app.post("/v1/text-stats")
def text_stats(body: TextStatsRequest) -> TextStatsResponse:
    # Example endpoint: replace with logic that needs a Python-only library.
    words = re.findall(r"[a-zA-Z']+", body.text.lower())
    return TextStatsResponse(
        words=len(words),
        characters=len(body.text),
        top_words=Counter(words).most_common(TOP_WORDS_LIMIT),
    )


app.include_router(agents_router)
