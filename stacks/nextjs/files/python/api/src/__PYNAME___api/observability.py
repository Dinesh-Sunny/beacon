"""Sentry for the sidecar. Off unless SENTRY_DSN is set; scrubbing matches the web app."""

import os
from typing import TYPE_CHECKING, Any, cast

import sentry_sdk
from sentry_sdk.types import Breadcrumb, BreadcrumbHint, Event, Hint

from __PYNAME___core.observability import SECRET_QUERY_PARAMS, scrub_breadcrumb, scrub_event

if TYPE_CHECKING:
    # Defined only for type checkers in sentry-sdk 2.x.
    from sentry_sdk._types import DataCollectionUserOptions

SENTRY_DSN_ENV = "SENTRY_DSN"
# Same sampling as the web app: a tenth of production requests, every request elsewhere.
PRODUCTION_TRACES_SAMPLE_RATE = 0.1
DEVELOPMENT_TRACES_SAMPLE_RATE = 1.0


# Same limits as the web app (sentry-options.ts): no bodies, cookies, user info, DB values, AI
# inputs, or local variables, and a short header allowlist. send_default_pii=False alone still
# attaches JSON request bodies and frame locals.
SAFE_HEADERS = ["user-agent", "accept-language", "content-type"]

DATA_COLLECTION: DataCollectionUserOptions = {
    "user_info": False,
    "cookies": {"mode": "off"},
    "http_headers": {"request": {"mode": "allowlist", "terms": SAFE_HEADERS}},
    "http_bodies": [],
    "url_query_params": {"mode": "denylist", "terms": sorted(SECRET_QUERY_PARAMS)},
    "graphql": {"document": False, "variables": False},
    "gen_ai": {"inputs": False, "outputs": False},
    "database_query_data": False,
    "stack_frame_variables": False,
}


# The core package stays free of sentry-sdk, so its scrubbers take plain dicts;
# these adapt the types.
def _before_send(event: Event, _hint: Hint) -> Event:
    return cast(Event, scrub_event(cast(dict[str, Any], event)))


def _before_breadcrumb(crumb: Breadcrumb, _hint: BreadcrumbHint) -> Breadcrumb:
    return scrub_breadcrumb(crumb)


def init_sentry() -> bool:
    """Initialise Sentry from env. Returns whether it is on."""
    dsn = os.environ.get(SENTRY_DSN_ENV)
    if not dsn:
        return False
    environment = os.environ.get("VERCEL_ENV", "development")
    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        # Vercel sets the commit per deployment; Sentry groups errors by release.
        release=os.environ.get("VERCEL_GIT_COMMIT_SHA"),
        send_default_pii=False,
        data_collection=DATA_COLLECTION,
        traces_sample_rate=(
            PRODUCTION_TRACES_SAMPLE_RATE
            if environment == "production"
            else DEVELOPMENT_TRACES_SAMPLE_RATE
        ),
        before_send=_before_send,
        before_send_transaction=_before_send,
        before_breadcrumb=_before_breadcrumb,
    )
    return True
