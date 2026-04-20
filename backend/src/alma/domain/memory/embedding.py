import asyncio
import logging
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
            return list(result.embeddings[0].values)
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


def create_embedding_provider(settings) -> EmbeddingProvider | None:
    if settings.gemini_api_key:
        return GeminiEmbedding(settings.gemini_api_key)
    if settings.openai_api_key:
        return OpenAIEmbedding(settings.openai_api_key)
    return None
