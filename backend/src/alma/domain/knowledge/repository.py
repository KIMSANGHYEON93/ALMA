import uuid

from sqlalchemy import desc, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from alma.models.models import Document, DocumentChunk


class DocumentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        title: str,
        content: str,
        source_type: str = "text",
        source_url: str | None = None,
    ) -> Document:
        doc = Document(
            user_id=user_id,
            title=title,
            content=content,
            source_type=source_type,
            source_url=source_url,
            status="processing",
        )
        self.session.add(doc)
        await self.session.commit()
        await self.session.refresh(doc)
        return doc

    async def get(self, doc_id: uuid.UUID) -> Document | None:
        result = await self.session.execute(select(Document).where(Document.id == doc_id))
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: uuid.UUID) -> list[Document]:
        result = await self.session.execute(
            select(Document).where(Document.user_id == user_id).order_by(desc(Document.created_at))
        )
        return list(result.scalars().all())

    async def update_status(self, doc: Document, status: str, chunk_count: int = 0) -> Document:
        doc.status = status
        doc.chunk_count = chunk_count
        await self.session.commit()
        await self.session.refresh(doc)
        return doc

    async def delete(self, doc_id: uuid.UUID) -> None:
        doc = await self.get(doc_id)
        if doc:
            await self.session.delete(doc)
            await self.session.commit()


class DocumentChunkRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_batch(
        self,
        document_id: uuid.UUID,
        user_id: uuid.UUID,
        chunks: list[tuple[int, str, list[float] | None]],
    ) -> int:
        """청크 배치 생성. chunks: [(index, content, embedding)]"""
        for idx, content, embedding in chunks:
            chunk = DocumentChunk(
                document_id=document_id,
                user_id=user_id,
                chunk_index=idx,
                content=content,
                embedding=embedding,
            )
            self.session.add(chunk)
        await self.session.commit()
        return len(chunks)

    async def search_similar(
        self, user_id: uuid.UUID, embedding: list[float], limit: int = 5
    ) -> list[DocumentChunk]:
        """pgvector 코사인 유사도 검색"""
        embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
        result = await self.session.execute(
            text("""
                SELECT dc.id, dc.document_id, dc.user_id, dc.chunk_index,
                       dc.content, dc.embedding, dc.created_at,
                       dc.embedding <=> :embedding AS distance
                FROM document_chunks dc
                WHERE dc.user_id = :user_id AND dc.embedding IS NOT NULL
                ORDER BY dc.embedding <=> :embedding
                LIMIT :limit
            """),
            {"user_id": str(user_id), "embedding": embedding_str, "limit": limit},
        )
        rows = result.fetchall()
        # 수동 매핑
        chunks = []
        for row in rows:
            chunk = DocumentChunk(
                id=row[0],
                document_id=row[1],
                user_id=row[2],
                chunk_index=row[3],
                content=row[4],
            )
            chunks.append(chunk)
        return chunks

    async def list_by_document(self, document_id: uuid.UUID) -> list[DocumentChunk]:
        result = await self.session.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.chunk_index)
        )
        return list(result.scalars().all())
