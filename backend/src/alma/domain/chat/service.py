import asyncio
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

SYSTEM_PROMPT = """You are VIVARA (The Origin of Your Life, Visualized) — a knowledgeable and thoughtful personal AI assistant that gives meaning to life data, discovers relationships, and suggests directions for growth.

Your mission: help users grow toward the life they desire.

Capabilities you can invoke (the system handles execution; you only need to acknowledge):
- Google Calendar: create / list events
- Habits: checkin, uncheckin, today summary, create, update, delete, analyze
- Goals: created and tracked via the Goals page
- Knowledge base: add text, search by semantic similarity
- Automations: list, create, suggest

Response Guidelines:
- ALWAYS respond directly and substantively. NEVER say "잠시만 기다려 주세요" or "잠시만요" or any placeholder waiting phrases.
- If the user asks you to perform an action (calendar, habit, knowledge, etc.), confirm clearly what will happen with concrete details (title, date, etc.). The system will execute it after your reply — you do NOT need to wait.
- If the user asks a general question, answer it directly with depth and structure.
- Always respond in Korean unless the user writes in another language.
- Use markdown for clarity (headers, lists, bold) when helpful.
- Be warm, encouraging, and professional. Concise by default; detailed when asked."""


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

    async def _build_request_context(
        self, user_id: str, conversation_id: str, content: str
    ) -> tuple[LLMRequest, str | None, object | None]:
        """LLM 요청 + provider_name + intent 구성. process_message와 stream 양쪽에서 공유."""
        # 1. 사용자 메시지에서 액션 인텐트 먼저 감지
        try:
            intent = await self.integration.detect_action_intent(content)
        except Exception:
            logger.warning("Action intent detection failed", exc_info=True)
            intent = None

        similar = await self.memory.search_similar(user_id, content, limit=3)
        history = await self.memory.get_conversation_history(conversation_id, limit=10)

        messages: list[ChatMessage] = []
        if similar:
            ctx = "\n".join([f"[Past {m.role}]: {m.content}" for m in similar])
            messages.append(ChatMessage(role="user", content=f"[Relevant past context]\n{ctx}"))
            messages.append(
                ChatMessage(role="assistant", content="I'll keep this context in mind.")
            )
        for msg in history:
            messages.append(msg)

        # 사용자 선호도 기반 system prompt 개인화
        preferences = await self.profile.get_decrypted_preferences(user_id)
        safe_prefs = {
            "language": preferences.get("language", "ko"),
            "response_style": preferences.get("response_style", "concise"),
            "interests": preferences.get("interests", [])[:10],
        }
        personalized_prompt = SYSTEM_PROMPT + f"\n\nUser preferences: {json.dumps(safe_prefs)}"

        if self.goal_service:
            goal_context = await self.goal_service.get_active_goals_context(user_id)
            if goal_context:
                personalized_prompt += f"\n\n{goal_context}"

        if self.habit_service:
            habit_context = await self.habit_service.get_habits_context(uuid.UUID(user_id))
            if habit_context:
                personalized_prompt += f"\n\n{habit_context}"

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

        if intent:
            # 자연어 서술 — 모델이 구조화 코드로 echo하지 않도록 함
            params_desc = (
                ", ".join(f"{k}={v}" for k, v in intent.params.items())
                if intent.params
                else "(none)"
            )
            personalized_prompt += (
                f"\n\nImportant: The user's request will trigger action "
                f"'{intent.service}.{intent.action}' ({params_desc}). "
                "The system will execute this action automatically RIGHT AFTER your reply. "
                "Your job is ONLY to write a short natural confirmation in Korean — "
                "tell the user what will happen (date, title, etc.) in 1-2 sentences. "
                "Do NOT output JSON, function calls, or structured templates. "
                "Do NOT say '잠시만 기다려주세요'. Just confirm clearly in plain Korean."
            )

        # provider 선택
        llm_model = preferences.get("llm_model")
        provider_name: str | None = None
        request_model: str | None = None
        if isinstance(getattr(self.llm, "providers", None), dict) and llm_model:
            if llm_model.startswith("claude"):
                provider_name = "claude"
            elif llm_model.startswith("gpt"):
                provider_name = "openai"
            elif llm_model.startswith("gemini"):
                provider_name = "gemini"
            else:
                provider_name = llm_model
            request_model = llm_model

        request = LLMRequest(
            messages=messages,
            system_prompt=personalized_prompt,
            model=request_model,
        )
        return request, provider_name, intent

    async def process_message_stream(self, user_id: str, conversation_id: str, content: str):
        """스트리밍 버전. 이벤트 dict를 yield:
        {"type": "chunk", "content": str} — 텍스트 델타
        {"type": "action_result", "content": str} — 액션 실행 결과 텍스트
        {"type": "done", "full_response": str} — 완료 시 전체 응답
        """
        await self.memory.store_message(conversation_id, "user", content, user_id=user_id)

        request, provider_name, intent = await self._build_request_context(
            user_id, conversation_id, content
        )

        llm_content = ""
        try:
            stream_iter = (
                self.llm.stream(request, provider_name=provider_name)
                if isinstance(getattr(self.llm, "providers", None), dict)
                else self.llm.stream(request)  # type: ignore[call-arg]
            )
            async for chunk in stream_iter:
                if chunk.delta:
                    llm_content += chunk.delta
                    yield {"type": "chunk", "content": chunk.delta}
                if chunk.is_final:
                    break
        except asyncio.CancelledError:
            # 취소 시 부분 응답도 저장 (나중에 재생성할 때 히스토리 참고)
            if llm_content:
                await self.memory.store_message(
                    conversation_id,
                    "assistant",
                    llm_content + "\n\n_[응답이 취소되었습니다]_",
                    user_id=user_id,
                )
            raise

        # LLM 응답 완료 후 액션 실행
        action_note = ""
        if intent:
            try:
                result = await self.integration.execute_action(user_id, intent)
                action_note = self._format_action_result(intent, result)
            except Exception as e:
                logger.warning("Action execution failed", exc_info=True)
                action_note = f"\n\n⚠️ 액션 실행 실패: {e}"

            if action_note:
                yield {"type": "action_result", "content": action_note}

        full_response = llm_content + action_note
        await self.memory.store_message(
            conversation_id, "assistant", full_response, user_id=user_id
        )

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

        yield {"type": "done", "full_response": full_response}

    async def process_message(self, user_id: str, conversation_id: str, content: str) -> str:
        """기존 REST/동기 호출용 — 내부적으로 스트림을 consume하여 full_response 반환."""
        full_response = ""
        async for event in self.process_message_stream(user_id, conversation_id, content):
            if event["type"] == "done":
                full_response = event["full_response"]
        return full_response

    def _format_habit_result(self, intent: object, result: dict) -> str:
        """habit 인텐트 자동 실행 결과를 자연어로 포맷 (구버전 호환용)"""
        return self._format_action_result(intent, result)

    def _format_action_result(self, intent: object, result: dict) -> str:
        """모든 인텐트 자동 실행 결과를 자연어로 포맷"""
        service = getattr(intent, "service", "")
        action = getattr(intent, "action", "")

        # 에러 처리 — error 키 또는 success=False
        if isinstance(result, dict) and (result.get("error") or result.get("success") is False):
            err = result.get("error") or "실행 실패"
            # 캘린더 미연결 안내는 친절하게
            if service == "calendar" and "not connected" in str(err).lower():
                return (
                    "\n\n⚠️ Google Calendar가 연결되어 있지 않습니다.\n"
                    "[설정 페이지](/settings)에서 Google 계정을 연결해주세요."
                )
            return f"\n\n⚠️ {err}"

        # Calendar
        if service == "calendar":
            if action == "create_event":
                event = result.get("event", {}) if isinstance(result, dict) else {}
                title = event.get("summary") or event.get("title") or "이벤트"
                start = event.get("start") or ""
                link = event.get("html_link") or ""
                msg = f"\n\n📅 캘린더에 추가했습니다: **{title}** {start}".rstrip()
                if link:
                    msg += f"\n[캘린더에서 보기]({link})"
                return msg
            if action == "list_events":
                events = result.get("events") or result.get("items") or []
                if not events:
                    return "\n\n📅 예정된 이벤트가 없습니다."
                lines = [
                    f"- **{(e.get('summary') or e.get('title') or '제목 없음')}** {e.get('start') or ''}".rstrip()
                    for e in events[:10]
                ]
                return "\n\n📅 예정된 이벤트:\n" + "\n".join(lines)

        # Habit
        if service == "habit":
            if action == "checkin":
                streak = result.get("streak", 0)
                habit_name = result.get("habit", "")
                return f"\n\n✅ '{habit_name}' 체크인 완료! 🔥{streak}일 연속"
            if action == "uncheckin":
                return f"\n\n⬜ '{result.get('habit', '')}' 체크인이 취소되었습니다"
            if action == "today":
                summary = result.get("summary", {})
                total = summary.get("total", 0)
                completed = summary.get("completed", 0)
                return f"\n\n📋 오늘 습관: {completed}/{total} 완료"
            if action == "create":
                return f"\n\n✨ 습관 '{result.get('habit', '')}'을 생성했습니다."
            if action == "delete":
                return f"\n\n🗑️ 습관 '{result.get('habit', '')}'을 삭제했습니다."
            if action == "update":
                return f"\n\n📝 습관 '{result.get('habit', '')}'을 업데이트했습니다."
            if action == "analyze":
                analysis = result.get("analysis") or result.get("insight") or ""
                return f"\n\n🔍 분석:\n{analysis}" if analysis else ""

        # Knowledge
        if service == "knowledge":
            if action == "add":
                title = result.get("title") or "문서"
                return f"\n\n📚 지식 베이스에 '{title}'를 추가했습니다."
            if action == "search":
                items = result.get("results") or []
                if not items:
                    return "\n\n📚 관련 문서를 찾지 못했습니다."
                lines = [
                    f"- **{i.get('title', '')}**: {(i.get('snippet') or '')[:120]}"
                    for i in items[:5]
                ]
                return "\n\n📚 검색 결과:\n" + "\n".join(lines)

        # Automation
        if service == "automation":
            if action == "create":
                return f"\n\n🤖 자동화 규칙 '{result.get('name', '')}'을 생성했습니다."
            if action == "list":
                rules = result.get("rules") or []
                return f"\n\n🤖 활성 자동화 규칙: {len(rules)}개"
            if action == "suggest":
                suggestions = result.get("suggestions") or []
                if suggestions:
                    return "\n\n💡 추천 자동화:\n" + "\n".join(f"- {s}" for s in suggestions[:5])

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
