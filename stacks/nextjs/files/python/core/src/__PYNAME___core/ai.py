"""Chat models through Vercel AI Gateway, for every agent in the workspace.

One OpenAI-compatible endpoint reaches every provider; fallbacks are tried in order when the
primary model fails. See docs/knowledge/ai.md.
"""

import os
from typing import Final

from langchain_openai import ChatOpenAI
from pydantic import SecretStr

AI_GATEWAY_BASE_URL: Final = "https://ai-gateway.vercel.sh/v1"

# An API key wins when set. On Vercel, functions get the deployment's OIDC token per request as
# the `x-vercel-oidc-token` header (the env var exists only in builds and `vercel env pull`, so
# locally it works for its ~12 h lifetime). Tokens expire, so models are built per run.
AI_GATEWAY_API_KEY_ENV: Final = "AI_GATEWAY_API_KEY"
VERCEL_OIDC_ENV: Final = "VERCEL_OIDC_TOKEN"
VERCEL_OIDC_HEADER: Final = "x-vercel-oidc-token"

# Agent reasoning and tool use.
MAIN_MODEL: Final = "anthropic/claude-sonnet-5.5"
MAIN_FALLBACKS: Final = ("openai/gpt-6.1-sol",)
# Small, frequent steps: thread titles, summaries, classification.
FAST_MODEL: Final = "anthropic/claude-haiku-4.5"
FAST_FALLBACKS: Final = ("openai/gpt-4.1-mini",)

# A stalled provider must not hold a run until the function limit; the gateway falls back instead.
REQUEST_TIMEOUT_SECONDS: Final = 60.0
MAX_RETRIES: Final = 2
# Caps spend per model call (a reply, not a document).
MAX_OUTPUT_TOKENS: Final = 2048
# Small steps (titles) must never hold a run: one short try.
FAST_TIMEOUT_SECONDS: Final = 5.0
FAST_MAX_OUTPUT_TOKENS: Final = 32


class AIGatewayNotConfiguredError(RuntimeError):
    """Neither an AI Gateway API key nor a Vercel OIDC token is available."""


def gateway_credential(request_oidc_token: str | None = None) -> str | None:
    """API key, else the request's OIDC token (Vercel), else the env token (local pull)."""
    return (
        os.environ.get(AI_GATEWAY_API_KEY_ENV)
        or request_oidc_token
        or os.environ.get(VERCEL_OIDC_ENV)
    )


def is_ai_configured(request_oidc_token: str | None = None) -> bool:
    return gateway_credential(request_oidc_token) is not None


def gateway_extra_body(fallbacks: tuple[str, ...]) -> dict[str, object]:
    """Request body fields AI Gateway reads for model fallbacks."""
    return {"providerOptions": {"gateway": {"models": list(fallbacks)}}}


def _chat_model(
    model: str,
    fallbacks: tuple[str, ...],
    credential: str,
    *,
    streaming: bool,
    timeout: float,
    max_retries: int,
    max_tokens: int,
) -> ChatOpenAI:
    return ChatOpenAI(
        model=model,
        base_url=AI_GATEWAY_BASE_URL,
        api_key=SecretStr(credential),
        extra_body=gateway_extra_body(fallbacks),
        timeout=timeout,
        max_retries=max_retries,
        max_completion_tokens=max_tokens,
        streaming=streaming,
    )


def require_credential(request_oidc_token: str | None = None) -> str:
    credential = gateway_credential(request_oidc_token)
    if credential is None:
        raise AIGatewayNotConfiguredError(
            f"Set {AI_GATEWAY_API_KEY_ENV}, or run on Vercel ({VERCEL_OIDC_HEADER})"
        )
    return credential


def main_model(credential: str) -> ChatOpenAI:
    return _chat_model(
        MAIN_MODEL,
        MAIN_FALLBACKS,
        credential,
        streaming=True,
        timeout=REQUEST_TIMEOUT_SECONDS,
        max_retries=MAX_RETRIES,
        max_tokens=MAX_OUTPUT_TOKENS,
    )


def fast_model(credential: str) -> ChatOpenAI:
    return _chat_model(
        FAST_MODEL,
        FAST_FALLBACKS,
        credential,
        streaming=False,
        timeout=FAST_TIMEOUT_SECONDS,
        max_retries=0,
        max_tokens=FAST_MAX_OUTPUT_TOKENS,
    )
