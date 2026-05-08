import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.memory.embedding import EmbeddingProvider
from alma.infrastructure.llm.base import ChatMessage
from alma.domain.chat.repository import ConversationRepository, MessageRepository

logger = logging.getLogger(__name__)


class MemoryService:
    def __init__(
        self,
        session: AsyncSession,
        embedding_provider: EmbeddingProvider | None = None,
    ):
        self.session = session
        self.embedding_provider = embedding_provider
        self.message_repo = MessageRepository(session)
        self.conversation_repo = ConversationRepository(session)

    async def store_message(
        self, conversation_id: str, role: str, content: str, user_id: str | None = None
    ) -> None:
        embedding = await self._get_embedding(content)
        msg = await self.message_repo.create(
            conversation_id=uuid.UUID(conversation_id),
            role=role,
            content=content,
            embedding=embedding,
        )
        try:
            from alma.core.events.helpers import emit

            await emit(
                "memory.created",
                "memory",
                {
                    "memory_id": str(msg.id),
                    "conversation_id": str(conversation_id),
                    "content": content,
                    "role": role,
                },
                user_id=user_id,
                aggregate_id=str(msg.id),
            )
        except Exception:
            pass

    async def search_similar(self, user_id: str, query: str, limit: int = 5) -> list[ChatMessage]:
        embedding = await self._get_embedding(query)
        if embedding is None:
            return []
        messages = await self.message_repo.search_similar(
            user_id=uuid.UUID(user_id), embedding=embedding, limit=limit
        )
        return [ChatMessage(role=m.role, content=m.content) for m in messages]

    async def get_conversation_history(
        self, conversation_id: str, limit: int = 20
    ) -> list[ChatMessage]:
        messages = await self.message_repo.get_history(
            conversation_id=uuid.UUID(conversation_id), limit=limit
        )
        return [ChatMessage(role=m.role, content=m.content) for m in messages]

    async def _get_embedding(self, text: str) -> list[float] | None:
        if self.embedding_provider is None:
            return None
        return await self.embedding_provider.embed(text)
