import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alma.models.models import UserMemory


class UserMemoryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        category: str,
        content: str,
        embedding: list[float] | None = None,
    ) -> UserMemory:
        mem = UserMemory(user_id=user_id, category=category, content=content, embedding=embedding)
        self.session.add(mem)
        await self.session.commit()
        await self.session.refresh(mem)
        return mem

    async def list_by_user(
        self,
        user_id: uuid.UUID,
        category: str | None = None,
        limit: int = 50,
    ) -> list[UserMemory]:
        query = select(UserMemory).where(UserMemory.user_id == user_id)
        if category:
            query = query.where(UserMemory.category == category)
        query = query.order_by(UserMemory.updated_at.desc()).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def search_similar(
        self,
        user_id: uuid.UUID,
        embedding: list[float],
        limit: int = 5,
    ) -> list[UserMemory]:
        query = (
            select(UserMemory)
            .where(UserMemory.user_id == user_id)
            .where(UserMemory.embedding.isnot(None))
            .order_by(UserMemory.embedding.cosine_distance(embedding))
            .limit(limit)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())
