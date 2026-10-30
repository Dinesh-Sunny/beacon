from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from __PYNAME___api.main import app
from __PYNAME___core.db import is_database_configured

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_text_stats_counts_words() -> None:
    response = client.post("/v1/text-stats", json={"text": "the cat and the hat"})
    assert response.status_code == 200
    body = response.json()
    assert body["words"] == 5
    assert body["top_words"][0] == ["the", 2]


def test_text_stats_rejects_empty_text() -> None:
    assert client.post("/v1/text-stats", json={"text": ""}).status_code == 422


def test_ready_reports_unconfigured_when_lifespan_has_no_pool() -> None:
    # The module-level client skips the lifespan, so no pool exists.
    response = client.get("/health/ready")
    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "db": "unconfigured"}


@pytest.mark.skipif(not is_database_configured(), reason="DATABASE_URL not set")
def test_ready_reports_ok_when_database_is_reachable() -> None:
    with TestClient(app) as live_client:
        response = live_client.get("/health/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": "ok"}


def test_ready_reports_down_when_database_is_unreachable(monkeypatch: pytest.MonkeyPatch) -> None:
    # Port 1 refuses connections immediately; the pool timeout bounds the wait either way.
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@127.0.0.1:1/none")
    with TestClient(app) as live_client:
        response = live_client.get("/health/ready")
    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "db": "down"}


@pytest.mark.usefixtures("with_verifier")
def test_me_returns_user_when_token_is_valid(service_token: Callable[..., str]) -> None:
    # Scheme is case-insensitive (RFC 7235).
    response = client.get("/v1/me", headers={"Authorization": f"bearer {service_token()}"})
    assert response.status_code == 200
    assert response.json() == {"user_id": "user-1", "email": "a@example.com"}


@pytest.mark.usefixtures("with_verifier")
def test_me_returns_401_when_token_is_missing_or_invalid() -> None:
    assert client.get("/v1/me").status_code == 401
    bad = client.get("/v1/me", headers={"Authorization": "Bearer nope"})
    assert bad.status_code == 401
    assert bad.headers["www-authenticate"] == "Bearer"
