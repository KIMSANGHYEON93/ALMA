import logging
import re
import uuid

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.knowledge.repository import DocumentChunkRepository, DocumentRepository
from alma.domain.memory.embedding import EmbeddingProvider
from alma.models.models import Document

logger = logging.getLogger(__name__)


def html_to_text(html: str) -> str:
    text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start = end - overlap
        if start >= len(text):
            break
    return chunks if chunks else [text]


class KnowledgeService:
    def __init__(
        self,
        session: AsyncSession,
        embedding_provider: EmbeddingProvider | None = None,
    ):
        self.session = session
        self.doc_repo = DocumentRepository(session)
        self.chunk_repo = DocumentChunkRepository(session)
        self.embedding_provider = embedding_provider

    async def add_document(
        self,
        user_id: uuid.UUID,
        title: str,
        content: str,
        source_type: str = "text",
        source_url: str | None = None,
    ) -> Document:
        doc = await self.doc_repo.create(user_id, title, content, source_type, source_url)
        try:
            chunks = chunk_text(content)
            chunk_data = []
            for i, chunk_content in enumerate(chunks):
                embedding = await self._get_embedding(chunk_content)
                chunk_data.append((i, chunk_content, embedding))
            await self.chunk_repo.create_batch(doc.id, user_id, chunk_data)
            await self.doc_repo.update_status(doc, "ready", len(chunks))

            try:
                from alma.core.events.helpers import emit

                await emit(
                    "knowledge.document_ingested",
                    "knowledge",
                    {"document_id": str(doc.id), "title": title, "chunks": len(chunks)},
                    user_id=str(user_id),
                    aggregate_id=str(doc.id),
                )
            except Exception:
                pass
        except Exception as e:
            logger.warning("Failed to process document: %s", e, exc_info=True)
            await self.doc_repo.update_status(doc, "error")
        return doc

    async def add_from_url(self, user_id: uuid.UUID, title: str, url: str) -> Document:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, follow_redirects=True)
                response.raise_for_status()
                content = html_to_text(response.text)
        except Exception as e:
            logger.warning("URL fetch failed: %s", e)
            content = f"URL 접근 실패: {url}"
        return await self.add_document(user_id, title, content, source_type="url", source_url=url)

    async def get_document(self, doc_id: uuid.UUID, user_id: uuid.UUID) -> Document | None:
        doc = await self.doc_repo.get(doc_id)
        if doc and doc.user_id == user_id:
            return doc
        return None

    async def list_documents(self, user_id: uuid.UUID) -> list[Document]:
        return await self.doc_repo.list_by_user(user_id)

    async def delete_document(self, doc_id: uuid.UUID) -> None:
        await self.doc_repo.delete(doc_id)

    async def search(self, user_id: uuid.UUID, query: str, limit: int = 5) -> list[dict]:
        embedding = await self._get_embedding(query)
        if embedding is None:
            return []
        chunks = await self.chunk_repo.search_similar(user_id, embedding, limit)
        results = []
        for chunk in chunks:
            doc = await self.doc_repo.get(chunk.document_id)
            results.append(
                {
                    "content": chunk.content,
                    "document_title": doc.title if doc else "Unknown",
                    "document_id": str(chunk.document_id),
                    "chunk_index": chunk.chunk_index,
                }
            )
        return results

    async def _get_embedding(self, text: str) -> list[float] | None:
        if not self.embedding_provider:
            return None
        try:
            return await self.embedding_provider.embed(text)
        except Exception:
            logger.warning("Embedding failed", exc_info=True)
            return None
