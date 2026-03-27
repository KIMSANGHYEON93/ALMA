from fastapi import APIRouter

from alma.config import settings
from alma.infrastructure.llm.claude import ClaudeProvider
from alma.infrastructure.llm.gemini_provider import GeminiProvider
from alma.infrastructure.llm.openai_provider import OpenAIProvider
from alma.infrastructure.llm.router import LLMRouter

router = APIRouter(prefix="/api/llm", tags=["llm"])


def create_llm_router(user_prefs: dict | None = None) -> LLMRouter:
    """Create LLM router with user-specific or global API keys"""
    providers: dict = {}

    # User keys take priority over global settings
    anthropic_key = (user_prefs or {}).get("anthropic_api_key") or settings.anthropic_api_key
    openai_key = (user_prefs or {}).get("openai_api_key") or settings.openai_api_key
    gemini_key = (user_prefs or {}).get("gemini_api_key") or settings.gemini_api_key

    if anthropic_key:
        providers["claude"] = ClaudeProvider()
        # Override the client's API key if user-specific
        if user_prefs and user_prefs.get("anthropic_api_key"):
            import anthropic

            providers["claude"].client = anthropic.AsyncAnthropic(api_key=anthropic_key)
    if openai_key:
        providers["openai"] = OpenAIProvider()
        if user_prefs and user_prefs.get("openai_api_key"):
            import openai

            providers["openai"].client = openai.AsyncOpenAI(api_key=openai_key)
    if gemini_key:
        providers["gemini"] = GeminiProvider()
        if user_prefs and user_prefs.get("gemini_api_key"):
            from google import genai

            providers["gemini"].client = genai.Client(api_key=gemini_key)

    default = "claude" if "claude" in providers else next(iter(providers), "claude")
    return LLMRouter(providers, default=default)


@router.get("/models")
async def list_models():
    llm_router = create_llm_router()
    return {
        "models": llm_router.list_available(),
        "default": llm_router.default,
    }
