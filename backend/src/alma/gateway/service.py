import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from alma.api.llm import create_llm_router
from alma.config import settings
from alma.domain.chat.service import ChatService
from alma.domain.growth.service import GoalService
from alma.domain.habit.service import HabitService
from alma.domain.knowledge.service import KnowledgeService
from alma.domain.memory.embedding import create_embedding_provider
from alma.gateway.models import UnifiedMessage, UnifiedResponse


class ChannelService:
    """모든 채널의 공통 메시지 처리"""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def process_message(self, msg: UnifiedMessage) -> UnifiedResponse:
        from alma.domain.chat.repository import ConversationRepository

        # conversation_id가 없으면 새 대화 생성
        conv_id = msg.conversation_id
        if not conv_id:
            conv_repo = ConversationRepository(self.session)
            conv = await conv_repo.create(uuid.UUID(msg.user_id))
            conv_id = str(conv.id)

        # ChatService 구성
        llm = create_llm_router()
        goal_service = GoalService(self.session)
        habit_service = HabitService(self.session)
        embedding = create_embedding_provider(settings)
        knowledge_service = KnowledgeService(self.session, embedding)

        chat_service = ChatService(
            session=self.session,
            llm=llm,
            goal_service=goal_service,
            habit_service=habit_service,
            knowledge_service=knowledge_service,
        )

        response_text = await chat_service.process_message(
            user_id=msg.user_id,
            conversation_id=conv_id,
            content=msg.content,
        )

        return UnifiedResponse(
            content=response_text,
            conversation_id=conv_id,
        )
