"""Request/response schemas. Mirror these in apps/web/src/lib/python-api.ts."""

from typing import Literal

from pydantic import BaseModel, Field


class Health(BaseModel):
    status: str


class Readiness(BaseModel):
    status: Literal["ok", "degraded"]
    db: Literal["ok", "down", "unconfigured"]


class Me(BaseModel):
    user_id: str
    email: str | None


class TextStatsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=100_000)


class TextStatsResponse(BaseModel):
    words: int
    characters: int
    top_words: list[tuple[str, int]]
