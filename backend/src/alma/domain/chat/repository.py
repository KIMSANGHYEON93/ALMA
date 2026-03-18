import uuid

from sqlalchemy import desc, select
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
