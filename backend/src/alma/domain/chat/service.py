import json
import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from alma.config import settings
from alma.domain.chat.repository import ConversationRepository
from alma.domain.identity.profile import UserProfileService
from alma.domain.integration.service import IntegrationService
from alma.domain.memory.embedding import create_embedding_provider
from alma.domain.memory.service import MemoryService
from alma.infrastructure.llm.base import ChatMessage, LLMProvider, LLMRequest

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are ALMA (Adaptive Life Management Agent), a knowledgeable and thoughtful personal AI assistant.

Your mission: help users grow toward the life they desire.

Guidelines:
- Provide detailed, well-structured responses with depth and insight
- When explaining concepts, include examples and actionable advice
- Remember past conversations and use that context for personalized help
- You can take actions on behalf of the user (calendar, notes) when asked
- Always respond in the user's language (Korean by default)
- Use markdown formatting when helpful (headers, lists, bold)
- Be warm, encouraging, and professional"""


class ChatService:
    def __init__(
        self,
        session: AsyncSession,
        llm: LLMProvider,
        goal_service=None,
        habit_service=None,
        knowledge_service=None,
    ):
        self.session = session
        self.llm = llm
        embedding_provider = create_embedding_provider(settings)
        self.memory = MemoryService(session, embedding_provider)
        self.integration = IntegrationService(session, llm, habit_service=habit_service)
        self.profile = UserProfileService(session)
        self.goal_service = goal_service
        self.habit_service = habit_service
        self.knowledge_service = knowledge_service
        self.conv_repo = ConversationRepository(session)

    async def process_message(self, user_id: str, conversation_id: str, content: str) -> str:
        await self.memory.store_message(conversation_id, "user", content)

        similar = await self.memory.search_similar(user_id, content, limit=3)
        history = await self.memory.get_conversation_history(conversation_id, limit=10)

        messages: list[ChatMessage] = []

        if similar:
            context = "\n".join([f"[Past {m.role}]: {m.content}" for m in similar])
            messages.append(ChatMessage(role="user", content=f"[Relevant past context]\n{context}"))
            messages.append(
                ChatMessage(role="assistant", content="I'll keep this context in mind.")
            )

        for msg in history:
            messages.append(msg)

        # 사용자 선호도 기반 system prompt 개인화 (decrypted for internal use)
        preferences = await self.profile.get_decrypted_preferences(user_id)
        safe_prefs = {
            "language": preferences.get("language", "ko"),
            "response_style": preferences.get("response_style", "concise"),
            "interests": preferences.get("interests", [])[:10],
        }
        personalized_prompt = SYSTEM_PROMPT + f"\n\nUser preferences: {json.dumps(safe_prefs)}"

        # 활성 목표 컨텍스트 주입 (optional)
        if self.goal_service:
            goal_context = await self.goal_service.get_active_goals_context(user_id)
            if goal_context:
                personalized_prompt += f"\n\n{goal_context}"

        # 활성 습관 컨텍스트 주입 (optional)
        if self.habit_service:
            habit_context = await self.habit_service.get_habits_context(uuid.UUID(user_id))
            if habit_context:
                personalized_prompt += f"\n\n{habit_context}"

        # 지식 RAG 검색 (optional)
        if self.knowledge_service:
            try:
                knowledge_results = await self.knowledge_service.search(uuid.UUID(user_id), content)
                if knowledge_results:
                    knowledge_ctx = "\n".join(
                        f"[Knowledge: {r['document_title']}] {r['content']}"
                        for r in knowledge_results[:3]
                    )
                    personalized_prompt += f"\n\n{knowledge_ctx}"
            except Exception:
                pass

        request = LLMRequest(messages=messages, system_prompt=personalized_prompt)
        # 사용자 선호 LLM 모델 사용 (LLMRouter인 경우)
        llm_model = preferences.get("llm_model")
        if hasattr(self.llm, "providers") and llm_model:
            # full model ID → provider name 추출
            provider_name = llm_model  # 기본: model ID 그대로
            if llm_model.startswith("claude"):
                provider_name = "claude"
            elif llm_model.startswith("gpt"):
                provider_name = "openai"
            elif llm_model.startswith("gemini"):
                provider_name = "gemini"
            # provider의 model 오버라이드
            provider = self.llm.providers.get(provider_name)
            if provider:
                provider.model = llm_model
            response = await self.llm.complete(request, provider_name=provider_name)
        else:
            response = await self.llm.complete(request)

        intent = await self.integration.detect_action_intent(response.content)
        action_note = ""
        if intent:
            if intent.needs_confirmation:
                action_note = (
                    f"\n\n---\n[Action: {intent.service}.{intent.action}"
                    f"({intent.params}). 실행할까요? (예/아니오)]"
                )
            else:
                # 자동 실행 (habit.checkin, habit.uncheckin, habit.today)
                result = await self.integration.execute_action(user_id, intent)
                action_note = self._format_habit_result(intent, result)

        full_response = response.content + action_note
        await self.memory.store_message(conversation_id, "assistant", full_response)

        # 첫 메시지 시 대화 제목 자동 생성
        await self._maybe_generate_title(conversation_id, content)

        try:
            from alma.core.events.helpers import emit

            await emit(
                "chat.message_processed",
                "chat",
                {"conversation_id": conversation_id, "content_preview": content[:100]},
                user_id=user_id,
            )
        except Exception:
            pass

        return full_response

    def _format_habit_result(self, intent: object, result: dict) -> str:
        """habit 인텐트 자동 실행 결과를 자연어로 포맷"""
        if not result.get("success"):
            return f"\n\n⚠️ {result.get('error', '실행 실패')}"

        action = getattr(intent, "action", "")
        if action == "checkin":
            streak = result.get("streak", 0)
            return f"\n\n✅ '{result['habit']}' 체크인 완료! 🔥{streak}일 연속"
        elif action == "uncheckin":
            return f"\n\n⬜ '{result['habit']}' 체크인이 취소되었습니다"
        elif action == "today":
            summary = result.get("summary", {})
            total = summary.get("total", 0)
            completed = summary.get("completed", 0)
            return f"\n\n📋 오늘 습관: {completed}/{total} 완료"
        return ""

    async def _maybe_generate_title(self, conversation_id: str, user_message: str) -> None:
        """첫 사용자 메시지를 기반으로 대화 제목을 자동 생성"""
        try:
            conv = await self.conv_repo.get(uuid.UUID(conversation_id))
            if not conv or conv.title:
                return
            # LLM에게 짧은 제목 요청
            title_request = LLMRequest(
                messages=[ChatMessage(role="user", content=user_message)],
                system_prompt="Generate a concise title (max 30 chars) in the same language as the message. Return ONLY the title, no quotes or explanation.",
                max_tokens=50,
                temperature=0.3,
            )
            title_response = await self.llm.complete(title_request)
            title = title_response.content.strip().strip('"').strip("'")[:50]
            if title:
                await self.conv_repo.update_title(uuid.UUID(conversation_id), title)
        except Exception:
            logger.warning("Failed to generate title", exc_info=True)
