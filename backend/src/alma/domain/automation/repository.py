import uuid
from datetime import datetime, timezone

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from alma.models.models import AutomationRule


class AutomationRuleRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        name: str,
        trigger_event: str,
        action_type: str,
        action_config: dict,
        trigger_condition: dict | None = None,
        description: str | None = None,
        confidence: float = 0.0,
    ) -> AutomationRule:
        rule = AutomationRule(
            user_id=user_id,
            name=name,
            trigger_event=trigger_event,
            trigger_condition=trigger_condition or {},
            action_type=action_type,
            action_config=action_config,
            description=description,
            confidence=confidence,
        )
        self.session.add(rule)
        await self.session.commit()
        await self.session.refresh(rule)
        return rule

    async def get(self, rule_id: uuid.UUID) -> AutomationRule | None:
        result = await self.session.execute(
            select(AutomationRule).where(AutomationRule.id == rule_id)
        )
        return result.scalar_one_or_none()

    async def list_by_user(
        self, user_id: uuid.UUID, active_only: bool = True
    ) -> list[AutomationRule]:
        query = select(AutomationRule).where(AutomationRule.user_id == user_id)
        if active_only:
            query = query.where(AutomationRule.is_active.is_(True))
        query = query.order_by(desc(AutomationRule.updated_at))
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def find_matching(self, user_id: uuid.UUID, event_type: str) -> list[AutomationRule]:
        """특정 이벤트 타입에 매칭되는 활성 규칙 조회"""
        result = await self.session.execute(
            select(AutomationRule).where(
                AutomationRule.user_id == user_id,
                AutomationRule.trigger_event == event_type,
                AutomationRule.is_active.is_(True),
            )
        )
        return list(result.scalars().all())

    async def update(self, rule: AutomationRule) -> AutomationRule:
        await self.session.commit()
        await self.session.refresh(rule)
        return rule

    async def delete(self, rule_id: uuid.UUID) -> None:
        rule = await self.get(rule_id)
        if rule:
            await self.session.delete(rule)
            await self.session.commit()

    async def increment_execution(self, rule_id: uuid.UUID) -> None:
        rule = await self.get(rule_id)
        if rule:
            rule.execution_count += 1
            rule.last_executed_at = datetime.now(timezone.utc).replace(tzinfo=None)
            await self.session.commit()
