from __PYNAME___core.observability import FILTERED, scrub_event, scrub_query_string, scrub_url


def test_scrub_url_filters_secret_query_values_when_a_token_is_present() -> None:
    assert (
        scrub_url("https://example.com/api/auth/verify-email?token=abc&callbackURL=%2F")
        == f"https://example.com/api/auth/verify-email?token={FILTERED}&callbackURL=%2F"
    )


def test_scrub_url_filters_the_secret_path_segment_when_a_reset_link_is_recorded() -> None:
    assert scrub_url("/api/auth/reset-password/abc?x=1") == (
        f"/api/auth/reset-password/{FILTERED}?x=1"
    )
    assert scrub_url("/accept-invitation/id/extra") == f"/accept-invitation/{FILTERED}/extra"
    assert scrub_url("/api/c15t/subjects/sub_abc") == f"/api/c15t/subjects/{FILTERED}"


def test_scrub_query_string_matches_names_regardless_of_case() -> None:
    assert scrub_query_string("Token=1&page=2") == f"Token={FILTERED}&page=2"


def test_scrub_event_scrubs_request_and_breadcrumbs_when_both_hold_urls() -> None:
    event = {
        "request": {"url": "https://api/x?code=9", "query_string": "code=9"},
        "breadcrumbs": {"values": [{"data": {"url": "https://web/y?otp=1"}}]},
    }
    scrubbed = scrub_event(event)
    assert scrubbed["request"]["url"] == f"https://api/x?code={FILTERED}"
    assert scrubbed["request"]["query_string"] == f"code={FILTERED}"
    assert scrubbed["breadcrumbs"]["values"][0]["data"]["url"] == f"https://web/y?otp={FILTERED}"


def test_scrub_event_scrubs_span_attributes_when_a_transaction_records_a_reset_link() -> None:
    reset = "/api/auth/reset-password/live?next=%2F"
    scrubbed_reset = f"/api/auth/reset-password/{FILTERED}?next=%2F"
    event = {
        "transaction": f"GET {reset}",
        "contexts": {"trace": {"data": {"http.target": reset, "url.query": "token=a"}}},
        "spans": [{"description": f"GET http://api{reset}", "data": {"url.full": reset}}],
    }
    scrubbed = scrub_event(event)
    assert scrubbed["transaction"] == f"GET {scrubbed_reset}"
    assert scrubbed["contexts"]["trace"]["data"] == {
        "http.target": scrubbed_reset,
        "url.query": f"token={FILTERED}",
    }
    assert scrubbed["spans"][0]["description"] == f"GET http://api{scrubbed_reset}"
    assert scrubbed["spans"][0]["data"]["url.full"] == scrubbed_reset


def test_scrub_query_string_keeps_other_pairs_unchanged_when_scrubbing() -> None:
    assert scrub_query_string("flag&a=%2F&token=x") == f"flag&a=%2F&token={FILTERED}"
