from dataclasses import dataclass
from typing import AsyncIterator, Protocol


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
    model: str | None = None  # per-request override; falls back to provider default


@dataclass(frozen=True)
class LLMResponse:
    content: str
    model: str
    input_tokens: int
    output_tokens: int


@dataclass(frozen=True)
class LLMStreamChunk:
    """스트리밍 한 조각.

    delta는 새로 추가된 텍스트 (누적이 아님).
    is_final=True인 경우 usage 메트릭이 채워진다.
    """

    delta: str
    is_final: bool = False
    input_tokens: int = 0
    output_tokens: int = 0
    model: str | None = None


class LLMProvider(Protocol):
    async def complete(self, request: LLMRequest) -> LLMResponse: ...

    def stream(self, request: LLMRequest) -> AsyncIterator[LLMStreamChunk]:
        """스트리밍 응답. 프로바이더가 미지원이면 complete()를 1회 호출로 시뮬레이션."""
        ...


async def _fallback_stream_from_complete(
    provider: LLMProvider, request: LLMRequest
) -> AsyncIterator[LLMStreamChunk]:
    """스트리밍을 지원하지 않는 프로바이더용 폴백 — complete() 결과를 단일 chunk로 반환."""
    response = await provider.complete(request)
    yield LLMStreamChunk(
        delta=response.content,
        is_final=True,
        input_tokens=response.input_tokens,
        output_tokens=response.output_tokens,
        model=response.model,
    )
