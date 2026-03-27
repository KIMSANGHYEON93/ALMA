import uuid
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class SimilarMatch:
    object_id: uuid.UUID
    name: str
    similarity: float


class DeduplicationService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def find_similar(
        self, user_id: uuid.UUID, embedding: list[float], threshold: float = 0.92
    ) -> SimilarMatch | None:
        query = text("""
            SELECT id, name, 1 - (embedding <=> :embedding::vector) AS similarity
            FROM ontology_objects
            WHERE user_id = :user_id
              AND status != 'archived'
              AND embedding IS NOT NULL
            ORDER BY embedding <=> :embedding::vector
            LIMIT 1
        """)
        result = await self.session.execute(
            query, {"user_id": user_id, "embedding": str(embedding)}
        )
        row = result.first()
        if row and row.similarity >= threshold:
            return SimilarMatch(object_id=row.id, name=row.name, similarity=row.similarity)
        return None
