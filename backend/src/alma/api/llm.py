from functools import lru_cache

from fastapi import APIRouter

from alma.config import settings
from alma.infrastructure.llm.claude import ClaudeProvider
from alma.infrastructure.llm.gemini_provider import GeminiProvider
from alma.infrastructure.llm.openai_provider import OpenAIProvider
from alma.infrastructure.llm.router import LLMRouter

router = APIRouter(prefix="/api/llm", tags=["llm"])


def create_llm_router(user_prefs: dict | None = None) -> LLMRouter:
    """Create LLM router with user-specific or global API keys.

    프로바이더 생성자는 매번 새 httpx 클라이언트와 ssl.SSLContext를 만들고,
    load_verify_locations()(CA 번들 파싱)에 수 초가 걸린다. 이 동기 작업이 async
    핸들러 안에서 연결·요청마다 반복되면 asyncio 이벤트 루프가 그동안 멈춰
    같은 프로세스의 다른 모든 HTTP 요청(PATCH/DELETE 등)이 응답 없이 밀린다.
    그래서 실제 생성은 사용자 키 조합별로 캐시한다.
    """
    prefs = user_prefs or {}
    return _build_llm_router(
        prefs.get("anthropic_api_key") or None,
        prefs.get("openai_api_key") or None,
        prefs.get("gemini_api_key") or None,
    )


@lru_cache(maxsize=32)
def _build_llm_router(
    user_anthropic_key: str | None,
    user_openai_key: str | None,
    user_gemini_key: str | None,
) -> LLMRouter:
    user_prefs = {
        "anthropic_api_key": user_anthropic_key,
        "openai_api_key": user_openai_key,
        "gemini_api_key": user_gemini_key,
    }
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
