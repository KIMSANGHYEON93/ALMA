import logging

from alma.infrastructure.llm.base import LLMProvider, LLMRequest, LLMResponse

logger = logging.getLogger(__name__)


class LLMRouter:
    """멀티 LLM 라우터: 프로바이더 선택 + 자동 폴백"""

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

    def list_available(self) -> list[str]:
        return list(self.providers.keys())
