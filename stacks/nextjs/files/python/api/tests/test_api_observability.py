from typing import Any

import pytest
import sentry_sdk

from __PYNAME___api import observability


def test_init_sentry_stays_off_when_no_dsn_is_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(observability.SENTRY_DSN_ENV, raising=False)
    calls: list[dict[str, Any]] = []
    monkeypatch.setattr(sentry_sdk, "init", lambda **kw: calls.append(kw))
    assert observability.init_sentry() is False
    assert calls == []


def test_init_sentry_blocks_bodies_and_locals_when_a_dsn_is_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(observability.SENTRY_DSN_ENV, "https://k@o1.ingest.sentry.io/2")
    calls: list[dict[str, Any]] = []
    monkeypatch.setattr(sentry_sdk, "init", lambda **kw: calls.append(kw))
    assert observability.init_sentry() is True
    collection = calls[0]["data_collection"]
    assert collection["http_bodies"] == []
    assert collection["stack_frame_variables"] is False
    assert calls[0]["send_default_pii"] is False
