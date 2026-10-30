"""Which chat models a run uses. A FastAPI dependency, so tests can swap in fake models."""

from collections.abc import Callable
from dataclasses import dataclass

from langchain_core.language_models import BaseChatModel

from __PYNAME___core.ai import fast_model, main_model


@dataclass(frozen=True, slots=True)
class ChatModels:
    main: Callable[[str], BaseChatModel]
    fast: Callable[[str], BaseChatModel]


def chat_models() -> ChatModels:
    return ChatModels(main=main_model, fast=fast_model)
