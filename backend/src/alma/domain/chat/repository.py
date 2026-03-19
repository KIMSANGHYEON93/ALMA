import uuid

from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from alma.models.models import Conversation, Message


class ConversationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, user_id: uuid.UUID, title: str | None = None) -> Conversation:
        conv = Conversation(user_id=user_id, title=title)
        self.session.add(conv)
        await self.session.commit()
        await self.session.refresh(conv)
        return conv

    async def get(self, conversation_id: uuid.UUID) -> Conversation | None:
        result = await self.session.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        return result.scalar_one_or_none()

    async def update_title(self, conversation_id: uuid.UUID, title: str) -> None:
        await self.session.execute(
            update(Conversation)
            .where(Conversation.id == conversation_id, Conversation.title.is_(None))
            .values(title=title)
        )
        await self.session.commit()

    async def list_by_user(self, user_id: uuid.UUID, limit: int = 20) -> list[Conversation]:
        result = await self.session.execute(
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .order_by(desc(Conversation.updated_at))
            .limit(limit)
        )
        return list(result.scalars().all())


class MessageRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        conversation_id: uuid.UUID,
        role: str,
        content: str,
        embedding: list[float] | None = None,
    ) -> Message:
        msg = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            embedding=embedding,
        )
        self.session.add(msg)
        await self.session.commit()
        await self.session.refresh(msg)
        return msg

    async def get_history(self, conversation_id: uuid.UUID, limit: int = 20) -> list[Message]:
        result = await self.session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_messages_paginated(
        self,
        conversation_id: uuid.UUID,
        limit: int = 20,
        before_id: uuid.UUID | None = None,
    ) -> tuple[list[Message], bool]:
        query = select(Message).where(Message.conversation_id == conversation_id)
        if before_id:
            subq = select(Message.created_at).where(Message.id == before_id).scalar_subquery()
            query = query.where(Message.created_at < subq)
        query = query.order_by(desc(Message.created_at)).limit(limit + 1)
        result = await self.session.execute(query)
        rows = list(result.scalars().all())
        has_more = len(rows) > limit
        messages = rows[:limit]
        messages.reverse()
        return messages, has_more

    async def search_similar(
        self, user_id: uuid.UUID, embedding: list[float], limit: int = 5
    ) -> list[Message]:
        result = await self.session.execute(
            select(Message)
            .join(Conversation)
            .where(Conversation.user_id == user_id)
            .where(Message.embedding.isnot(None))
            .order_by(Message.embedding.cosine_distance(embedding))
            .limit(limit)
        )
        return list(result.scalars().all())
