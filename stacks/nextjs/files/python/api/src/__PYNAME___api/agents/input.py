"""What a run accepts from the browser. LangGraph merges client-sent messages and state into the
saved conversation, so only one new user message (plus history it already saved) gets through;
client state and forwarded props are dropped (identity and scope never come from them)."""

from typing import Final

from ag_ui.core.types import RunAgentInput, UserMessage

MAX_USER_MESSAGE_CHARS: Final = 8000
MAX_MESSAGES: Final = 200


class RunInputError(ValueError):
    """The request carries something a run can't accept."""


def sanitize_run_input(body: RunAgentInput, saved_ids: set[str]) -> RunAgentInput:
    if len(body.messages) > MAX_MESSAGES:
        raise RunInputError("Too many messages")
    new = [message for message in body.messages if message.id not in saved_ids]
    if len(new) > 1 or any(not isinstance(message, UserMessage) for message in new):
        raise RunInputError("Only one new user message per run")
    for message in new:
        if not isinstance(message.content, str) or len(message.content) > MAX_USER_MESSAGE_CHARS:
            raise RunInputError("Message too long")
    return body.model_copy(update={"state": {}, "forwarded_props": {}})


def new_user_text(body: RunAgentInput, saved_ids: set[str]) -> str | None:
    for message in body.messages:
        if (
            message.id not in saved_ids
            and isinstance(message, UserMessage)
            and isinstance(message.content, str)
        ):
            return message.content
    return None
