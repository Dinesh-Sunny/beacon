"""Verify Better Auth service tokens (JWTs) issued by the web app.

The web app signs short-lived EdDSA tokens (`/api/auth/token`) and publishes its public keys at
`/api/auth/jwks`. The issuer is the app's canonical origin and the audience is fixed
(SERVICE_AUDIENCE, `SERVICE_TOKEN_AUDIENCE` in packages/auth). Both mirror packages/auth
(`origins.ts`, `config.ts`); keep them in step.
"""

import os
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any, Final

import jwt

AUTH_URL_ENV: Final = "BETTER_AUTH_URL"
JWKS_PATH: Final = "/api/auth/jwks"
SERVICE_AUDIENCE: Final = "__NAME__-api"
ALGORITHMS: Final = ["EdDSA"]
REQUIRED_CLAIMS: Final = ["exp", "iat", "sub", "iss", "aud"]
# Signing keys rotate every 30 days with a grace period; refetch at most this often.
JWKS_CACHE_SECONDS: Final = 300
# A slow or unreachable web app must not tie up worker threads.
JWKS_FETCH_TIMEOUT_SECONDS: Final = 5

type SigningKeyResolver = Callable[[str], Any]


class InvalidTokenError(Exception):
    """The token is missing, malformed, expired, or not signed by the app."""


class TokenVerificationUnavailableError(Exception):
    """The signing keys couldn't be fetched; the token may be fine (retry, report 503)."""


@dataclass(frozen=True)
class ServiceTokenClaims:
    user_id: str
    email: str | None
    claims: Mapping[str, Any]


class TokenVerifier:
    def __init__(
        self,
        issuer: str,
        resolve_signing_key: SigningKeyResolver,
        audience: str = SERVICE_AUDIENCE,
    ) -> None:
        self._issuer = issuer.rstrip("/")
        self._resolve_signing_key = resolve_signing_key
        self._audience = audience

    def verify(self, token: str) -> ServiceTokenClaims:
        try:
            key = self._resolve_signing_key(token)
            claims = jwt.decode(
                token,
                key,
                algorithms=ALGORITHMS,
                issuer=self._issuer,
                audience=self._audience,
                options={"require": REQUIRED_CLAIMS},
            )
        except jwt.PyJWKClientConnectionError as error:
            raise TokenVerificationUnavailableError(str(error)) from error
        except jwt.PyJWTError as error:
            raise InvalidTokenError(str(error)) from error
        return ServiceTokenClaims(user_id=claims["sub"], email=claims.get("email"), claims=claims)


def resolve_issuer(env: Mapping[str, str]) -> str | None:
    """Canonical origin, same rules as packages/auth resolveAuthOrigins()."""
    preview_host = env.get("VERCEL_BRANCH_URL") or env.get("VERCEL_URL")
    if env.get("VERCEL_ENV") == "preview" and preview_host:
        return f"https://{preview_host}"
    if configured := env.get(AUTH_URL_ENV):
        return configured.rstrip("/")
    if production_host := env.get("VERCEL_PROJECT_PRODUCTION_URL"):
        return f"https://{production_host}"
    return None


def verifier_from_env(env: Mapping[str, str] = os.environ) -> TokenVerifier | None:
    """Build a verifier that fetches and caches the app's JWKS; None without auth config."""
    issuer = resolve_issuer(env)
    if not issuer:
        return None
    client = jwt.PyJWKClient(
        f"{issuer}{JWKS_PATH}",
        cache_keys=True,
        lifespan=JWKS_CACHE_SECONDS,
        timeout=JWKS_FETCH_TIMEOUT_SECONDS,
    )
    return TokenVerifier(issuer, lambda token: client.get_signing_key_from_jwt(token).key)
