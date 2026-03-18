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
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        self._genai = genai

    async def embed(self, text: str) -> list[float] | None:
        try:
            result = await asyncio.to_thread(
                self._genai.embed_content,
                model="models/text-embedding-004",
                content=text,
            )
            return result["embedding"]
        except Exception:
            logger.warning("Gemini embedding failed", exc_info=True)
            return None


class OpenAIEmbedding:
    dimensions = 768

    def __init__(self, api_key: str):
        import openai

        self._client = openai.AsyncOpenAI(api_key=api_key)

    async def embed(self, text: str) -> list[float] | None:
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
