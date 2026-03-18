from dataclasses import dataclass

from alma.infrastructure.llm.base import ChatMessage


@dataclass(frozen=True)
class SearchQuery:
    user_id: str
    query: str
    limit: int = 5


@dataclass(frozen=True)
class SearchResult:
    messages: list[ChatMessage]
    scores: list[float]
