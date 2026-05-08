import json
import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.integration.repository import ActionLogRepository, IntegrationRepository
from alma.infrastructure.llm.base import ChatMessage, LLMProvider, LLMRequest


@dataclass
class ActionIntent:
    service: str
    action: str
    params: dict
    needs_confirmation: bool = True


class IntegrationService:
    def __init__(self, session: AsyncSession, llm: LLMProvider, habit_service=None):
        self.session = session
        self.llm = llm
        self.action_log_repo = ActionLogRepository(session)
        self.integration_repo = IntegrationRepository(session)
        self.habit_service = habit_service

    async def detect_action_intent(self, user_message: str) -> ActionIntent | None:
        prompt = (
            "Analyze if this message requires an external action.\n"
            "Available services and actions:\n"
            "- calendar.create_event: create calendar event\n"
            "- calendar.list_events: list calendar events\n"
            "- habit.checkin: check in a habit (params: title, completed=true, value?, note?)\n"
            "- habit.uncheckin: uncheck a habit (params: title)\n"
            "- habit.today: show today's habit summary (params: {})\n"
            "- habit.create: create a new habit (params: title, frequency_type, frequency_value, target_value?, target_unit?)\n"
            "- habit.update: update a habit (params: title, ...fields to change)\n"
            "- habit.delete: delete a habit (params: title)\n"
            "- habit.analyze: analyze habit patterns and provide coaching (params: {})\n"
            "- automation.suggest: suggest automation rules based on patterns (params: {})\n"
            "- automation.list: list user's automation rules (params: {})\n"
            "- automation.create: create an automation rule (params: name, trigger_event, action_type, action_config)\n"
            "- knowledge.add: add text to knowledge base (params: title, content)\n"
            "- knowledge.search: search knowledge base (params: query)\n\n"
            "Rules:\n"
            "- habit.checkin, habit.uncheckin, habit.today → needs_confirmation=false\n"
            "- habit.analyze → needs_confirmation=false\n"
            "- habit.create, habit.update, habit.delete → needs_confirmation=true\n"
            "- calendar actions → needs_confirmation=true\n"
            "- automation.suggest, automation.list → needs_confirmation=false\n"
            "- automation.create → needs_confirmation=true\n"
            "- knowledge.search → needs_confirmation=false\n"
            "- knowledge.add → needs_confirmation=true\n\n"
            'If action needed, respond with JSON: {"service":"...","action":"...","params":{...},"needs_confirmation":true/false}\n'
            "If no action needed, respond with: null\n"
            "Message: " + user_message
        )

        # 인텐트 감지는 단순 분류 작업 — 빠르고 저렴한 모델로 고정
        # LLMRouter인 경우 provider별 가장 가벼운 모델을 명시적으로 지정
        fast_models = {
            "claude": "claude-haiku-4-5-20251001",
            "openai": "gpt-4o-mini",
            "gemini": "gemini-2.0-flash",
        }
        provider_name = None
        request_model: str | None = None
        if hasattr(self.llm, "providers") and isinstance(
            getattr(self.llm, "providers", None), dict
        ):
            # Router available — prefer claude haiku, fallback to any available provider
            for p in ("claude", "openai", "gemini"):
                if p in self.llm.providers:
                    provider_name = p
                    request_model = fast_models[p]
                    break

        request = LLMRequest(
            messages=[ChatMessage(role="user", content=prompt)],
            max_tokens=500,
            temperature=0.0,
            model=request_model,
        )
        if provider_name and hasattr(self.llm, "complete"):
            # LLMRouter는 provider_name 파라미터 지원
            try:
                response = await self.llm.complete(request, provider_name=provider_name)  # type: ignore
            except TypeError:
                response = await self.llm.complete(request)
        else:
            response = await self.llm.complete(request)

        try:
            data = json.loads(response.content)
            if data is None:
                return None
            return ActionIntent(**data)
        except (json.JSONDecodeError, TypeError):
            return None

    async def execute_action(self, user_id: str, intent: ActionIntent) -> dict:
        result: dict = {}
        success = True

        try:
            if intent.service == "calendar":
                result = await self._execute_calendar_action(user_id, intent)
            elif intent.service == "habit":
                result = await self._execute_habit_action(user_id, intent)
            elif intent.service == "knowledge":
                result = await self._execute_knowledge_action(user_id, intent)
            elif intent.service == "automation":
                result = await self._execute_automation_action(user_id, intent)
            elif intent.service == "notion":
                result = await self._execute_notion_action(user_id, intent)
            else:
                result = {"error": f"Unknown service: {intent.service}"}
                success = False
        except Exception as e:
            result = {"error": str(e)}
            success = False

        await self.action_log_repo.create(
            user_id=uuid.UUID(user_id),
            service=intent.service,
            action=intent.action,
            params=intent.params,
            result=result,
            success=success,
        )

        try:
            from alma.core.events.helpers import emit

            await emit(
                "integration.action_executed",
                "integration",
                {"service": intent.service, "action": intent.action, "success": success},
                user_id=user_id,
            )
        except Exception:
            pass

        return result

    async def _execute_calendar_action(self, user_id: str, intent: ActionIntent) -> dict:
        # 먼저 active로 시도, 없으면 expired(재발급 가능한 상태) 시도
        integration = await self.integration_repo.get_active(uuid.UUID(user_id), "google_calendar")
        if not integration:
            # expired 상태여도 refresh_token이 있으면 복구 시도
            all_integrations = await self.integration_repo.list_by_user(uuid.UUID(user_id))
            integration = next(
                (
                    i
                    for i in all_integrations
                    if i.provider == "google_calendar" and i.refresh_token
                ),
                None,
            )
        if not integration:
            return {
                "error": "Google Calendar not connected",
                "connect_url": "/api/integrations/google/connect",
            }

        from dataclasses import asdict

        from alma.domain.integration.calendar import GoogleCalendarProvider

        provider = GoogleCalendarProvider(integration, self.integration_repo)
        if intent.action == "create_event":
            event = await provider.create_event(**intent.params)
            return {"status": "created", "event": asdict(event)}
        elif intent.action == "list_events":
            events = await provider.list_events(**intent.params)
            return {"status": "ok", "events": [asdict(e) for e in events]}
        return {"error": f"Unknown calendar action: {intent.action}"}

    async def _execute_habit_action(self, user_id: str, intent: ActionIntent) -> dict:
        if not self.habit_service:
            return {"error": "Habit service not available"}

        uid = uuid.UUID(user_id)
        params = intent.params
        action = intent.action

        if action == "analyze":
            from alma.domain.habit.analytics import HabitAnalyticsService

            analytics = HabitAnalyticsService(self.session, self.llm)
            result = await analytics.generate_insight(uid)
            return {"success": True, "content": result["content"]}

        if action == "today":
            summary = await self.habit_service.get_today_summary(uid)
            return {"success": True, "summary": summary}

        if action == "create":
            create_params = dict(params)
            if "start_date" in create_params and isinstance(create_params["start_date"], str):
                create_params["start_date"] = date.fromisoformat(create_params["start_date"])
            new_habit = await self.habit_service.create_habit(uid, **create_params)
            return {"success": True, "habit": new_habit.title, "created": True}

        title = params.get("title", "")
        matches = await self.habit_service.find_by_title(uid, title)

        if len(matches) == 0:
            return {"success": False, "error": f"'{title}' 습관을 찾을 수 없습니다"}
        if len(matches) > 1:
            return {
                "success": False,
                "error": "여러 습관이 일치합니다",
                "matches": [h.title for h in matches],
            }

        habit = matches[0]

        if action == "checkin":
            await self.habit_service.checkin(
                habit.id,
                uid,
                date.today(),
                completed=True,
                source="chat",
                value=params.get("value"),
                note=params.get("note"),
            )
            streak = await self.habit_service.get_streak(habit, date.today())
            return {"success": True, "habit": habit.title, "streak": streak}

        if action == "uncheckin":
            await self.habit_service.checkin(
                habit.id,
                uid,
                date.today(),
                completed=False,
                source="chat",
            )
            return {"success": True, "habit": habit.title, "unchecked": True}

        if action == "update":
            changes = {k: v for k, v in params.items() if k != "title"}
            updated = await self.habit_service.update_habit(habit, **changes)
            return {"success": True, "habit": updated.title, "updated": True}

        if action == "delete":
            await self.habit_service.delete_habit(habit.id)
            return {"success": True, "habit": habit.title, "deleted": True}

        return {"success": False, "error": f"Unknown action: {action}"}

    async def _execute_automation_action(self, user_id: str, intent: ActionIntent) -> dict:
        from alma.domain.automation.service import AutomationService

        uid = uuid.UUID(user_id)
        service = AutomationService(self.session, self.llm)

        if intent.action == "suggest":
            suggestions = await service.suggest_automations(uid)
            return {"success": True, "suggestions": suggestions}
        elif intent.action == "list":
            rules = await service.list_rules(uid)
            return {
                "success": True,
                "rules": [
                    {"name": r.name, "trigger": r.trigger_event, "active": r.is_active}
                    for r in rules
                ],
            }
        elif intent.action == "create":
            params = intent.params
            rule = await service.create_rule(
                uid,
                params.get("name", "새 규칙"),
                params.get("trigger_event", ""),
                params.get("action_type", "notification"),
                params.get("action_config", {}),
            )
            return {"success": True, "rule": rule.name, "created": True}
        return {"success": False, "error": f"Unknown automation action: {intent.action}"}

    async def _execute_knowledge_action(self, user_id: str, intent: ActionIntent) -> dict:
        from alma.domain.knowledge.service import KnowledgeService

        uid = uuid.UUID(user_id)
        service = KnowledgeService(self.session)

        if intent.action == "search":
            results = await service.search(uid, intent.params.get("query", ""))
            return {"success": True, "results": results}
        elif intent.action == "add":
            doc = await service.add_document(
                uid,
                intent.params.get("title", "채팅에서 추가"),
                intent.params.get("content", ""),
            )
            return {"success": True, "document": doc.title, "created": True}
        return {"success": False, "error": f"Unknown knowledge action: {intent.action}"}

    async def _execute_notion_action(self, user_id: str, intent: ActionIntent) -> dict:
        return {
            "status": "action_ready",
            "service": "notion",
            "action": intent.action,
            "params": intent.params,
        }
