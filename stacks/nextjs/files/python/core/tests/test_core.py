from __PYNAME___core import healthcheck


def test_healthcheck_returns_ok() -> None:
    assert healthcheck() == "ok"
