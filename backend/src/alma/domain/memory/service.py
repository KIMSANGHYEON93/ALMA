import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from alma.infrastructure.llm.base import ChatMessage
from alma.domain.chat.repository import ConversationRepository, MessageRepository

logger = logging.getLogger(__name__)


class MemoryService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.message_repo = MessageRepository(session)
        self.conversation_repo = ConversationRepository(session)

    async def store_message(self, conversation_id: str, role: str, content: str) -> None:
        embedding = await self._get_embedding(content)
        await self.message_repo.create(
            conversation_id=uuid.UUID(conversation_id),
            role=role,
            content=content,
            embedding=embedding,
        )

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
        from alma.config import settings

        if settings.gemini_api_key:
            try:
                import google.generativeai as genai

                genai.configure(api_key=settings.gemini_api_key)
                result = genai.embed_content(model="models/text-embedding-004", content=text)
                return result["embedding"]
            except Exception:
                logger.warning("Gemini embedding failed, skipping")
                return None

        if settings.openai_api_key:
            try:
                import openai

                client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
                response = await client.embeddings.create(
                    model="text-embedding-3-small", input=text
                )
                return response.data[0].embedding
            except Exception:
                logger.warning("OpenAI embedding failed, skipping")
                return None

        return None
