# backend/src/alma/domain/automation/service.py
import json
import logging
import uuid
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from alma.core.events.helpers import emit
from alma.core.events.models import DomainEvent
from alma.core.events.store import EventStoreRepository
from alma.domain.automation.repository import AutomationRuleRepository
from alma.infrastructure.llm.base import ChatMessage, LLMProvider, LLMRequest
from alma.models.models import AutomationRule

logger = logging.getLogger(__name__)


class AutomationService:
    def __init__(self, session: AsyncSession, llm: LLMProvider | None = None):
        self.session = session
        self.rule_repo = AutomationRuleRepository(session)
        self.event_store = EventStoreRepository(session)
        self.llm = llm

    # --- CRUD ---

    async def create_rule(
        self,
        user_id: uuid.UUID,
        name: str,
        trigger_event: str,
        action_type: str,
        action_config: dict,
        trigger_condition: dict | None = None,
        description: str | None = None,
    ) -> AutomationRule:
        return await self.rule_repo.create(
            user_id=user_id,
            name=name,
            trigger_event=trigger_event,
            action_type=action_type,
            action_config=action_config,
            trigger_condition=trigger_condition,
            description=description,
        )

    async def get_rule(self, rule_id: uuid.UUID, user_id: uuid.UUID) -> AutomationRule | None:
        rule = await self.rule_repo.get(rule_id)
        if rule and rule.user_id == user_id:
            return rule
        return None

    async def list_rules(
        self, user_id: uuid.UUID, active_only: bool = True
    ) -> list[AutomationRule]:
        return await self.rule_repo.list_by_user(user_id, active_only)

    async def update_rule(self, rule: AutomationRule, **kwargs) -> AutomationRule:
        for key, value in kwargs.items():
            if hasattr(rule, key):
                setattr(rule, key, value)
        return await self.rule_repo.update(rule)

    async def delete_rule(self, rule_id: uuid.UUID) -> None:
        await self.rule_repo.delete(rule_id)

    async def toggle_rule(
        self, rule_id: uuid.UUID, user_id: uuid.UUID, is_active: bool
    ) -> AutomationRule | None:
        rule = await self.get_rule(rule_id, user_id)
        if not rule:
            return None
        rule.is_active = is_active
        return await self.rule_repo.update(rule)

    # --- Event Trigger ---

    async def handle_event(self, event: DomainEvent) -> None:
        if not event.user_id:
            return
        try:
            rules = await self.rule_repo.find_matching(uuid.UUID(event.user_id), event.event_type)
            for rule in rules:
                if self._matches_condition(event.payload, rule.trigger_condition or {}):
                    await self._execute_rule(rule, event)
        except Exception:
            logger.warning("Automation handle_event failed", exc_info=True)

    @staticmethod
    def _matches_condition(payload: dict, condition: dict) -> bool:
        if not condition:
            return True
        return all(payload.get(k) == v for k, v in condition.items())

    async def _execute_rule(self, rule: AutomationRule, event: DomainEvent) -> None:
        try:
            if rule.action_type == "notification":
                await emit(
                    "automation.notification",
                    "automation",
                    {
                        "message": rule.action_config.get("message", ""),
                        "rule_id": str(rule.id),
                    },
                    user_id=event.user_id,
                )
            elif rule.action_type == "log":
                await emit(
                    "automation.logged",
                    "automation",
                    {
                        "log_message": rule.action_config.get("log_message", ""),
                        "rule_id": str(rule.id),
                    },
                    user_id=event.user_id,
                )
            await self.rule_repo.increment_execution(rule.id)
        except Exception:
            logger.warning("Rule execution failed: %s", rule.id, exc_info=True)

    # --- LLM Pattern Detection ---

    async def suggest_automations(self, user_id: uuid.UUID) -> list[dict]:
        if not self.llm:
            return []

        since = datetime.utcnow() - timedelta(days=7)
        events = await self.event_store.query_by_user(user_id, since, limit=50)
        if len(events) < 5:
            return []

        event_summary = "\n".join(
            f"[{e.event_type}] {json.dumps(e.payload, ensure_ascii=False)}" for e in events[:30]
        )
        prompt = f"""사용자의 최근 이벤트를 분석하여 자동화 규칙을 제안하세요.

이벤트 시퀀스:
{event_summary}

가능한 action_type: "notification", "log"
JSON 배열로 최대 3개 제안 (한국어):
[{{"name": "규칙이름", "description": "설명", "trigger_event": "이벤트타입", "trigger_condition": {{}}, "action_type": "notification", "action_config": {{"message": "메시지"}}}}]

JSON만 응답하세요."""

        try:
            request = LLMRequest(
                messages=[ChatMessage(role="user", content=prompt)],
                max_tokens=1000,
                temperature=0.3,
            )
            response = await self.llm.complete(request)
            content = response.content.strip()
            if "```" in content:
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            return json.loads(content)
        except (json.JSONDecodeError, Exception):
            logger.warning("Failed to parse automation suggestions", exc_info=True)
            return []
