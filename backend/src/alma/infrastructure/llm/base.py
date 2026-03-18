from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ChatMessage:
    role: str
    content: str


@dataclass(frozen=True)
class LLMRequest:
    messages: list[ChatMessage]
    system_prompt: str | None = None
    max_tokens: int = 4096
    temperature: float = 0.7


@dataclass(frozen=True)
class LLMResponse:
    content: str
    model: str
    input_tokens: int
    output_tokens: int


class LLMProvider(Protocol):
    async def complete(self, request: LLMRequest) -> LLMResponse: ...
