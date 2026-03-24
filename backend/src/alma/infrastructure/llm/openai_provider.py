import openai

from alma.config import settings
from alma.infrastructure.llm.base import LLMRequest, LLMResponse


class OpenAIProvider:
    def __init__(self, model: str = "gpt-4o-mini"):
        self.client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = model

    async def complete(self, request: LLMRequest) -> LLMResponse:
        messages: list[dict[str, str]] = []
        if request.system_prompt:
            messages.append({"role": "system", "content": request.system_prompt})
        messages.extend({"role": m.role, "content": m.content} for m in request.messages)

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
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
