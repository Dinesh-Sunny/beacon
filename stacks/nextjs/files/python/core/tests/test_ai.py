import pytest

from __PYNAME___core import ai


def test_gateway_credential_uses_api_key_when_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(ai.AI_GATEWAY_API_KEY_ENV, "key")
    assert ai.gateway_credential("header-token") == "key"


def test_gateway_credential_uses_request_token_when_no_api_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(ai.AI_GATEWAY_API_KEY_ENV, raising=False)
    monkeypatch.setenv(ai.VERCEL_OIDC_ENV, "env-token")
    assert ai.gateway_credential("header-token") == "header-token"
    assert ai.gateway_credential() == "env-token"


def test_require_credential_raises_when_nothing_is_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(ai.AI_GATEWAY_API_KEY_ENV, raising=False)
    monkeypatch.delenv(ai.VERCEL_OIDC_ENV, raising=False)
    assert not ai.is_ai_configured()
    with pytest.raises(ai.AIGatewayNotConfiguredError):
        ai.require_credential()


def test_main_model_uses_gateway_fallbacks_and_output_cap_when_built() -> None:
    model = ai.main_model("key")
    assert model.model_name == ai.MAIN_MODEL
    assert model.openai_api_base == ai.AI_GATEWAY_BASE_URL
    assert model.max_tokens == ai.MAX_OUTPUT_TOKENS
    assert model.extra_body == {"providerOptions": {"gateway": {"models": list(ai.MAIN_FALLBACKS)}}}


def test_fast_model_never_retries_when_built() -> None:
    model = ai.fast_model("key")
    assert model.max_retries == 0
    assert model.request_timeout == ai.FAST_TIMEOUT_SECONDS
