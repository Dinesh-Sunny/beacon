"""Service-token helpers shared by the API tests: a signing key the app's verifier trusts."""

import time
from collections.abc import Callable, Iterator

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from __PYNAME___api.main import app
from __PYNAME___core.auth import SERVICE_AUDIENCE, TokenVerifier

ISSUER = "http://localhost:3000"
SIGNING_KEY = Ed25519PrivateKey.generate()


@pytest.fixture
def service_token() -> Callable[..., str]:
    """Mints a token like the web app's: 15-minute EdDSA JWT for a user id."""

    def mint(user_id: str = "user-1", email: str = "a@example.com") -> str:
        now = int(time.time())
        claims = {"sub": user_id, "email": email, "iss": ISSUER, "aud": SERVICE_AUDIENCE}
        return jwt.encode({**claims, "iat": now, "exp": now + 60}, SIGNING_KEY, algorithm="EdDSA")

    return mint


@pytest.fixture
def test_verifier() -> TokenVerifier:
    """Trusts the tokens `service_token` mints. A live client's lifespan installs the real
    verifier, so tests using one set this again after startup."""
    return TokenVerifier(ISSUER, lambda _t: SIGNING_KEY.public_key())


@pytest.fixture
def with_verifier(test_verifier: TokenVerifier) -> Iterator[None]:
    app.state.token_verifier = test_verifier
    yield
    app.state.token_verifier = None
