import logging
from typing import AsyncIterator

from alma.infrastructure.llm.base import (
    LLMProvider,
    LLMRequest,
    LLMResponse,
    LLMStreamChunk,
)

logger = logging.getLogger(__name__)


class LLMRouter:
    """멀티 LLM 라우터: 프로바이더 선택 + 자동 폴백 (complete & stream)."""

    def __init__(self, providers: dict[str, LLMProvider], default: str = "claude"):
        self.providers = providers
        self.default = default

    async def complete(self, request: LLMRequest, provider_name: str | None = None) -> LLMResponse:
        name = provider_name or self.default
        provider = self.providers.get(name)
        if not provider:
            logger.warning("Unknown provider '%s', using default '%s'", name, self.default)
            provider = self.providers.get(self.default)
            if not provider:
                raise ValueError("No providers available")

        try:
            return await provider.complete(request)
        except Exception as e:
            logger.warning("Provider '%s' failed: %s, trying fallback", name, e)
            for fallback_name, fallback in self.providers.items():
                if fallback_name != name:
                    try:
                        response = await fallback.complete(request)
                        logger.info("Fallback to '%s' succeeded", fallback_name)
                        return response
                    except Exception:
                        continue
            raise

    async def stream(
        self, request: LLMRequest, provider_name: str | None = None
    ) -> AsyncIterator[LLMStreamChunk]:
        """스트리밍 응답을 yield. 첫 chunk가 나오기 전에 실패하면 fallback을 시도.
        스트리밍 시작 후 실패하면 예외를 그대로 전파 (부분 상태 방지)."""
        name = provider_name or self.default
        provider = self.providers.get(name)
        if not provider:
            logger.warning("Unknown provider '%s', using default '%s'", name, self.default)
            provider = self.providers.get(self.default)
            if not provider:
                raise ValueError("No providers available")

        # 첫 chunk 이전에 실패하면 fallback을 시도하기 위해 iterator를 직접 조작
        iterator: AsyncIterator[LLMStreamChunk] | None = None
        first_chunk: LLMStreamChunk | None = None
        tried: list[str] = []

        async def try_provider(p_name: str, p: LLMProvider):
            nonlocal iterator, first_chunk
            iterator = p.stream(request).__aiter__()
            first_chunk = await iterator.__anext__()

        try:
            await try_provider(name, provider)
        except StopAsyncIteration:
            return
        except Exception as e:
            logger.warning("Primary stream '%s' failed before first chunk: %s", name, e)
            tried.append(name)
            iterator = None
            first_chunk = None

        # Fallback chain if primary failed
        if iterator is None:
            for fallback_name, fallback in self.providers.items():
                if fallback_name in tried:
                    continue
                try:
                    await try_provider(fallback_name, fallback)
                    logger.info("Stream fallback to '%s' succeeded", fallback_name)
                    break
                except StopAsyncIteration:
                    return
                except Exception:
                    tried.append(fallback_name)
                    continue

            if iterator is None:
                raise RuntimeError("All LLM providers failed to stream")

        # Yield the first chunk we captured, then continue iterating
        if first_chunk is not None:
            yield first_chunk

        async for chunk in iterator:
            yield chunk

    def list_available(self) -> list[str]:
        return list(self.providers.keys())
