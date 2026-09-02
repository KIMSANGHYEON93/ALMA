import asyncio
import logging
from functools import lru_cache
from typing import Protocol

logger = logging.getLogger(__name__)

EMBEDDING_DIMENSIONS = 768


class EmbeddingProvider(Protocol):
    async def embed(self, text: str) -> list[float] | None: ...

    @property
    def dimensions(self) -> int: ...


class GeminiEmbedding:
    dimensions = 768

    def __init__(self, api_key: str):
        from google import genai

        self._client = genai.Client(api_key=api_key)

    async def embed(self, text: str) -> list[float] | None:
        if not text or not text.strip():
            return None
        try:
            result = await asyncio.to_thread(
                self._client.models.embed_content,
                model="gemini-embedding-001",
                contents=text,
                config={"output_dimensionality": self.dimensions},
            )
            embeddings = result.embeddings
            if not embeddings or not embeddings[0].values:
                return None
            return list(embeddings[0].values)
        except Exception:
            logger.warning("Gemini embedding failed", exc_info=True)
            return None


class OpenAIEmbedding:
    dimensions = 768

    def __init__(self, api_key: str):
        import openai

        self._client = openai.AsyncOpenAI(api_key=api_key)

    async def embed(self, text: str) -> list[float] | None:
        if not text or not text.strip():
            return None
        try:
            response = await self._client.embeddings.create(
                model="text-embedding-3-small",
                input=text,
                dimensions=768,
            )
            return response.data[0].embedding
        except Exception:
            logger.warning("OpenAI embedding failed", exc_info=True)
            return None


@lru_cache(maxsize=8)
def _build_embedding_provider(
    gemini_api_key: str | None, openai_api_key: str | None
) -> EmbeddingProvider | None:
    """실제 클라이언트 생성. 결과는 API 키 조합별로 캐시된다.

    genai.Client / openai.AsyncOpenAI 생성자는 매번 새 ssl.SSLContext를 만들며
    load_verify_locations()(CA 번들 파싱)에 수 초가 걸린다. 이 비용을 요청·연결마다
    반복하면 그동안 asyncio 이벤트 루프가 통째로 멈춰 다른 모든 HTTP 요청이 밀린다.
    """
    if gemini_api_key:
        return GeminiEmbedding(gemini_api_key)
    if openai_api_key:
        return OpenAIEmbedding(openai_api_key)
    return None


def create_embedding_provider(settings) -> EmbeddingProvider | None:
    return _build_embedding_provider(settings.gemini_api_key, settings.openai_api_key)
