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
            "- habit.delete: delete a habit (params: title)\n\n"
            "Rules:\n"
            "- habit.checkin, habit.uncheckin, habit.today → needs_confirmation=false\n"
            "- habit.create, habit.update, habit.delete → needs_confirmation=true\n"
            "- calendar actions → needs_confirmation=true\n\n"
            'If action needed, respond with JSON: {"service":"...","action":"...","params":{...},"needs_confirmation":true/false}\n'
            "If no action needed, respond with: null\n"
            "Message: " + user_message
        )

        request = LLMRequest(
            messages=[ChatMessage(role="user", content=prompt)],
            max_tokens=500,
            temperature=0.0,
        )
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

        return result

    async def _execute_calendar_action(self, user_id: str, intent: ActionIntent) -> dict:
        integration = await self.integration_repo.get_active(uuid.UUID(user_id), "google_calendar")
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

    async def _execute_notion_action(self, user_id: str, intent: ActionIntent) -> dict:
        return {
            "status": "action_ready",
            "service": "notion",
            "action": intent.action,
            "params": intent.params,
        }
