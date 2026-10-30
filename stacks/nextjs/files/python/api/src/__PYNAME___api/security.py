"""Who is calling: the service token the web app forwards (EdDSA JWT verified against its JWKS)."""

import logging
from typing import Annotated

from fastapi import Header, HTTPException, Request, status

from __PYNAME___core.auth import (
    InvalidTokenError,
    ServiceTokenClaims,
    TokenVerificationUnavailableError,
    TokenVerifier,
)

logger = logging.getLogger(__name__)

BEARER_SCHEME = "bearer"


# Sync on purpose: FastAPI runs it in a worker thread, so the occasional JWKS fetch never blocks
# the event loop.
def current_user(
    request: Request, authorization: Annotated[str | None, Header()] = None
) -> ServiceTokenClaims:
    verifier: TokenVerifier | None = getattr(request.app.state, "token_verifier", None)
    if verifier is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Auth is not configured")
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != BEARER_SCHEME or not token:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return verifier.verify(token.strip())
    except TokenVerificationUnavailableError:
        logger.exception("could not fetch auth signing keys")
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Auth temporarily unavailable"
        ) from None
    except InvalidTokenError:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
