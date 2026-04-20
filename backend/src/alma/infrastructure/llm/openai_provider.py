from typing import AsyncIterator

import openai

from alma.config import settings
from alma.infrastructure.llm.base import LLMRequest, LLMResponse, LLMStreamChunk


class OpenAIProvider:
    def __init__(self, model: str = "gpt-4o-mini"):
        self.client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = model

    def _build_messages(self, request: LLMRequest) -> list[dict[str, str]]:
        messages: list[dict[str, str]] = []
        if request.system_prompt:
            messages.append({"role": "system", "content": request.system_prompt})
        messages.extend({"role": m.role, "content": m.content} for m in request.messages)
        return messages

    async def complete(self, request: LLMRequest) -> LLMResponse:
        response = await self.client.chat.completions.create(
            model=request.model or self.model,
            messages=self._build_messages(request),
            max_tokens=request.max_tokens,
            temperature=request.temperature,
        )

        choice = response.choices[0]
        usage = response.usage

        return LLMResponse(
            content=choice.message.content or "",
            model=response.model,
            input_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
        )

    async def stream(self, request: LLMRequest) -> AsyncIterator[LLMStreamChunk]:
        model_name = request.model or self.model
        stream = await self.client.chat.completions.create(
            model=model_name,
            messages=self._build_messages(request),
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            stream=True,
            stream_options={"include_usage": True},
        )

        input_tokens = 0
        output_tokens = 0

        async for chunk in stream:
            # 중간 chunk — 델타 텍스트만
            if chunk.choices:
                delta = chunk.choices[0].delta
                if delta and getattr(delta, "content", None):
                    yield LLMStreamChunk(delta=delta.content or "")

            # 마지막 chunk에 usage 포함 (stream_options.include_usage=True 덕분)
            if getattr(chunk, "usage", None):
                input_tokens = chunk.usage.prompt_tokens or 0
                output_tokens = chunk.usage.completion_tokens or 0

        yield LLMStreamChunk(
            delta="",
            is_final=True,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            model=model_name,
        )
