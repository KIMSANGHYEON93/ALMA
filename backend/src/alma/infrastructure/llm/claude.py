import anthropic

from alma.config import settings
from alma.infrastructure.llm.base import LLMRequest, LLMResponse


class ClaudeProvider:
    def __init__(self, model: str = "claude-sonnet-4-20250514"):
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = model

    async def complete(self, request: LLMRequest) -> LLMResponse:
        messages = [{"role": m.role, "content": m.content} for m in request.messages]

        kwargs: dict = {
            "model": self.model,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "messages": messages,
        }
        if request.system_prompt:
            kwargs["system"] = request.system_prompt

        response = await self.client.messages.create(**kwargs)

        return LLMResponse(
            content=response.content[0].text,
            model=response.model,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )
