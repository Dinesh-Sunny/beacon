"""Scrub single-use secrets from URLs before error and analytics events leave the service.

Mirrors apps/web/src/lib/observability/scrub.ts and scrub-events.ts; keep the lists in step.
"""

import re
from collections.abc import Mapping
from typing import Any
from urllib.parse import urlsplit, urlunsplit

FILTERED = "[Filtered]"

SECRET_QUERY_PARAMS = frozenset(
    {"token", "code", "otp", "secret", "password", "key", "api_key", "signature"}
)

SECRET_PATH_PREFIXES = (
    "/api/auth/reset-password/",
    "/admin/reset/",
    "/accept-invitation/",
    "/api/c15t/subjects/",
)

# Attribute keys that can hold a query, or a URL or path (`http.target`, `url.full`, `url.path`,
# `http.url`, breadcrumb `from` / `to`).
_QUERY_KEY = re.compile(r"(^|[._])query$", re.IGNORECASE)
_URL_KEY = re.compile(r"(url|full|target|path|pathname|referrer|from|to)$", re.IGNORECASE)
_URL_START = re.compile(r"^(/|https?://)")


def _scrub_path(path: str) -> str:
    for prefix in SECRET_PATH_PREFIXES:
        at = path.find(prefix)
        if at == -1:
            continue
        start = at + len(prefix)
        slash = path.find("/", start)
        rest = "" if slash == -1 else path[slash:]
        path = f"{path[:start]}{FILTERED}{rest}"
    return path


def scrub_query_string(query: str) -> str:
    """Replace secret values; every other pair is kept byte for byte."""
    pairs = []
    for pair in query.split("&"):
        name, sep, _value = pair.partition("=")
        pairs.append(f"{name}={FILTERED}" if sep and name.lower() in SECRET_QUERY_PARAMS else pair)
    return "&".join(pairs)


def scrub_url(value: str) -> str:
    parts = urlsplit(value)
    return urlunsplit(
        parts._replace(path=_scrub_path(parts.path), query=scrub_query_string(parts.query))
    )


def scrub_text(text: str) -> str:
    """Span descriptions and transaction names, e.g. "GET /api/auth/reset-password/<token>"."""
    return " ".join(scrub_url(part) if _URL_START.match(part) else part for part in text.split(" "))


def scrub_url_fields(record: object) -> None:
    if not isinstance(record, dict):
        return
    for key, value in record.items():
        if not isinstance(value, str):
            continue
        if _QUERY_KEY.search(key):
            record[key] = scrub_query_string(value)
        elif _URL_KEY.search(key):
            record[key] = scrub_url(value)


def scrub_event(event: dict[str, Any], _hint: Mapping[str, Any] | None = None) -> dict[str, Any]:
    """Sentry `before_send` / `before_send_transaction`: request, spans, and breadcrumbs."""
    request = event.get("request")
    if isinstance(request, dict):
        if isinstance(request.get("url"), str):
            request["url"] = scrub_url(request["url"])
        if isinstance(request.get("query_string"), str):
            request["query_string"] = scrub_query_string(request["query_string"])
    if isinstance(event.get("transaction"), str):
        event["transaction"] = scrub_text(event["transaction"])
    contexts = event.get("contexts")
    if isinstance(contexts, dict) and isinstance(contexts.get("trace"), dict):
        scrub_url_fields(contexts["trace"].get("data"))
    for span in event.get("spans") or []:
        if isinstance(span, dict):
            scrub_url_fields(span.get("data"))
            if isinstance(span.get("description"), str):
                span["description"] = scrub_text(span["description"])
    breadcrumbs = event.get("breadcrumbs")
    values = breadcrumbs.get("values") if isinstance(breadcrumbs, dict) else breadcrumbs
    for crumb in values if isinstance(values, list) else []:
        if isinstance(crumb, dict):
            scrub_breadcrumb(crumb)
    return event


def scrub_breadcrumb(
    crumb: dict[str, Any], _hint: Mapping[str, Any] | None = None
) -> dict[str, Any]:
    scrub_url_fields(crumb.get("data"))
    return crumb
