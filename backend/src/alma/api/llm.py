from fastapi import APIRouter

from alma.config import settings
from alma.infrastructure.llm.claude import ClaudeProvider
from alma.infrastructure.llm.gemini_provider import GeminiProvider
from alma.infrastructure.llm.openai_provider import OpenAIProvider
from alma.infrastructure.llm.router import LLMRouter

router = APIRouter(prefix="/api/llm", tags=["llm"])


def create_llm_router() -> LLMRouter:
    """설정된 API 키를 기반으로 사용 가능한 프로바이더만 등록"""
    providers: dict = {}
    if settings.anthropic_api_key:
        providers["claude"] = ClaudeProvider()
    if settings.openai_api_key:
        providers["openai"] = OpenAIProvider()
    if settings.gemini_api_key:
        providers["gemini"] = GeminiProvider()

    default = "claude" if "claude" in providers else next(iter(providers), "claude")
    return LLMRouter(providers, default=default)


@router.get("/models")
async def list_models():
    llm_router = create_llm_router()
    return {
        "models": llm_router.list_available(),
        "default": llm_router.default,
    }
