import time

import jwt
import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from __PYNAME___core.auth import (
    SERVICE_AUDIENCE,
    InvalidTokenError,
    TokenVerificationUnavailableError,
    TokenVerifier,
    resolve_issuer,
)

ISSUER = "http://localhost:3000"
PRIVATE_KEY = Ed25519PrivateKey.generate()
OTHER_KEY = Ed25519PrivateKey.generate()


def make_token(*, key: Ed25519PrivateKey = PRIVATE_KEY, **overrides: object) -> str:
    now = int(time.time())
    claims: dict[str, object] = {
        "sub": "user-123",
        "email": "person@example.com",
        "iss": ISSUER,
        "aud": SERVICE_AUDIENCE,
        "iat": now,
        "exp": now + 900,
        **overrides,
    }
    return jwt.encode(claims, key, algorithm="EdDSA")


VERIFIER = TokenVerifier(ISSUER, lambda _token: PRIVATE_KEY.public_key())


def test_verify_returns_claims_when_token_is_valid() -> None:
    claims = VERIFIER.verify(make_token())
    assert claims.user_id == "user-123"
    assert claims.email == "person@example.com"


@pytest.mark.parametrize(
    "token",
    [
        make_token(key=OTHER_KEY),
        make_token(aud=ISSUER),
        make_token(iss="https://other.example"),
        make_token(exp=int(time.time()) - 10),
        "not-a-jwt",
    ],
    ids=["wrong-key", "wrong-audience", "wrong-issuer", "expired", "malformed"],
)
def test_verify_raises_when_token_is_untrusted(token: str) -> None:
    with pytest.raises(InvalidTokenError):
        VERIFIER.verify(token)


def test_verify_raises_unavailable_when_keys_cannot_be_fetched() -> None:
    def unreachable(_token: str) -> object:
        raise pyjwt.PyJWKClientConnectionError("connection refused")

    with pytest.raises(TokenVerificationUnavailableError):
        TokenVerifier(ISSUER, unreachable).verify(make_token())


@pytest.mark.parametrize(
    ("env", "expected"),
    [
        ({"BETTER_AUTH_URL": "https://app.example.com/"}, "https://app.example.com"),
        (
            {
                "VERCEL_ENV": "preview",
                "VERCEL_BRANCH_URL": "__NAME__-git-x.vercel.app",
                "BETTER_AUTH_URL": "https://app.example.com",
            },
            "https://__NAME__-git-x.vercel.app",
        ),
        ({"VERCEL_PROJECT_PRODUCTION_URL": "__NAME__.vercel.app"}, "https://__NAME__.vercel.app"),
        ({}, None),
    ],
    ids=["configured", "preview", "production-fallback", "unconfigured"],
)
def test_resolve_issuer_matches_web_rules(env: dict[str, str], expected: str | None) -> None:
    assert resolve_issuer(env) == expected
