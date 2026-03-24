from google import genai

from alma.config import settings
from alma.infrastructure.llm.base import LLMRequest, LLMResponse


class GeminiProvider:
    def __init__(self, model: str = "gemini-2.0-flash"):
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model = model

    async def complete(self, request: LLMRequest) -> LLMResponse:
        contents: list[dict] = []
        if request.system_prompt:
            contents.append(
                {"role": "user", "parts": [{"text": f"[System] {request.system_prompt}"}]}
            )
            contents.append({"role": "model", "parts": [{"text": "Understood."}]})
        for m in request.messages:
            role = "model" if m.role == "assistant" else "user"
            contents.append({"role": role, "parts": [{"text": m.content}]})

        response = await self.client.aio.models.generate_content(
            model=self.model,
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
            model=self.model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )
