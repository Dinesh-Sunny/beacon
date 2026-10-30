"""Short titles for the conversation list, from the first message (the fast model)."""

import logging
from typing import Final

from langchain_core.language_models import BaseChatModel

logger = logging.getLogger(__name__)

MAX_TITLE_CHARS: Final = 60
# Quotes and trailing punctuation models add around a title.
TITLE_STRIP_CHARS: Final = "\"' ."
# Enough to name a conversation; the rest only costs tokens.
MAX_TITLE_INPUT_CHARS: Final = 500
TITLE_PROMPT: Final = (
    "Write a title of at most six words for a conversation that starts with the message "
    "below. Plain words, no quotes, no punctuation at the end. Reply with the title only."
)


def fallback_title(message: str) -> str:
    """The message itself, cut at a word boundary: used when the model call fails."""
    text = " ".join(message.split())
    if len(text) <= MAX_TITLE_CHARS:
        return text
    return text[:MAX_TITLE_CHARS].rsplit(" ", 1)[0] + "…"


async def title_for(message: str, model: BaseChatModel) -> str:
    try:
        reply = await model.ainvoke(
            [("system", TITLE_PROMPT), ("human", message[:MAX_TITLE_INPUT_CHARS])]
        )
    except Exception as error:
        # A title is a nicety: never fail the run over it. Error type only, no content.
        logger.warning("title generation failed: %s", type(error).__name__)
        return fallback_title(message)
    title = " ".join(str(reply.content).split()).strip(TITLE_STRIP_CHARS)
    return title[:MAX_TITLE_CHARS] if title else fallback_title(message)
