from typing import AsyncIterator

from google import genai

from alma.config import settings
from alma.infrastructure.llm.base import LLMRequest, LLMResponse, LLMStreamChunk


class GeminiProvider:
    def __init__(self, model: str = "gemini-2.0-flash"):
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model = model

    def _build_contents(self, request: LLMRequest) -> list[dict]:
        contents: list[dict] = []
        if request.system_prompt:
            contents.append(
                {"role": "user", "parts": [{"text": f"[System] {request.system_prompt}"}]}
            )
            contents.append({"role": "model", "parts": [{"text": "Understood."}]})
        for m in request.messages:
            role = "model" if m.role == "assistant" else "user"
            contents.append({"role": role, "parts": [{"text": m.content}]})
        return contents

    async def complete(self, request: LLMRequest) -> LLMResponse:
        contents = self._build_contents(request)

        response = await self.client.aio.models.generate_content(
            model=request.model or self.model,
            contents=contents,
            config={
                "max_output_tokens": request.max_tokens,
                "temperature": request.temperature,
            },
        )

        text = response.text or ""
        input_tokens = response.usage_metadata.prompt_token_count if response.usage_metadata else 0
        output_tokens = (
            response.usage_metadata.candidates_token_count if response.usage_metadata else 0
        )

        return LLMResponse(
            content=text,
            model=request.model or self.model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

    async def stream(self, request: LLMRequest) -> AsyncIterator[LLMStreamChunk]:
        model_name = request.model or self.model
        contents = self._build_contents(request)

        stream = await self.client.aio.models.generate_content_stream(
            model=model_name,
            contents=contents,
            config={
                "max_output_tokens": request.max_tokens,
                "temperature": request.temperature,
            },
        )

        input_tokens = 0
        output_tokens = 0

        async for chunk in stream:
            text = getattr(chunk, "text", None)
            if text:
                yield LLMStreamChunk(delta=text)

            usage = getattr(chunk, "usage_metadata", None)
            if usage:
                input_tokens = getattr(usage, "prompt_token_count", 0) or 0
                output_tokens = getattr(usage, "candidates_token_count", 0) or 0

        yield LLMStreamChunk(
            delta="",
            is_final=True,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            model=model_name,
        )
