import json
import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from alma.infrastructure.llm.base import ChatMessage, LLMProvider, LLMRequest
from alma.domain.integration.repository import ActionLogRepository


@dataclass
class ActionIntent:
    service: str
    action: str
    params: dict
    needs_confirmation: bool = True


class IntegrationService:
    def __init__(self, session: AsyncSession, llm: LLMProvider):
        self.session = session
        self.llm = llm
        self.action_log_repo = ActionLogRepository(session)

    async def detect_action_intent(self, user_message: str) -> ActionIntent | None:
        prompt = (
            "Analyze if this message requires an external action (calendar, notes).\n"
            'If yes, respond with JSON: {"service":"calendar|notion","action":"...","params":{...},"needs_confirmation":true}\n'
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
                result = await self._execute_calendar_action(intent)
            elif intent.service == "notion":
                result = await self._execute_notion_action(intent)
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

    async def _execute_calendar_action(self, intent: ActionIntent) -> dict:
        return {
            "status": "action_ready",
            "service": "calendar",
            "action": intent.action,
            "params": intent.params,
        }

    async def _execute_notion_action(self, intent: ActionIntent) -> dict:
        return {
            "status": "action_ready",
            "service": "notion",
            "action": intent.action,
            "params": intent.params,
        }
