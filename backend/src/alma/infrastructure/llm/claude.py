from typing import AsyncIterator

import anthropic

from alma.config import settings
from alma.infrastructure.llm.base import LLMRequest, LLMResponse, LLMStreamChunk


class ClaudeProvider:
    def __init__(self, model: str = "claude-sonnet-4-20250514"):
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = model

    def _build_kwargs(self, request: LLMRequest) -> dict:
        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        kwargs: dict = {
            "model": request.model or self.model,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "messages": messages,
        }
        if request.system_prompt:
            kwargs["system"] = request.system_prompt
        return kwargs

    async def complete(self, request: LLMRequest) -> LLMResponse:
        kwargs = self._build_kwargs(request)
        response = await self.client.messages.create(**kwargs)

        return LLMResponse(
            content=response.content[0].text,
            model=response.model,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )

    async def stream(self, request: LLMRequest) -> AsyncIterator[LLMStreamChunk]:
        kwargs = self._build_kwargs(request)

        async with self.client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                if text:
                    yield LLMStreamChunk(delta=text)

            # 스트림 완료 후 최종 메시지에서 usage 추출
            final_message = await stream.get_final_message()
            yield LLMStreamChunk(
                delta="",
                is_final=True,
                input_tokens=final_message.usage.input_tokens,
                output_tokens=final_message.usage.output_tokens,
                model=final_message.model,
            )
