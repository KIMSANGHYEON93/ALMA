# backend/tests/test_automation.py
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from alma.core.events.models import DomainEvent
from alma.domain.automation.service import AutomationService


@pytest.mark.asyncio
async def test_create_rule(db_session: AsyncSession, test_user):
    service = AutomationService(db_session)
    rule = await service.create_rule(
        test_user.id,
        "운동 알림",
        "habit.checkin_completed",
        "notification",
        {"message": "잘했어요!"},
        trigger_condition={"completed": True},
    )
    assert rule.name == "운동 알림"
    assert rule.is_active is True
    assert rule.execution_count == 0


@pytest.mark.asyncio
async def test_list_rules(db_session: AsyncSession, test_user):
    service = AutomationService(db_session)
    await service.create_rule(
        test_user.id, "Rule 1", "habit.created", "log", {"log_message": "test"}
    )
    await service.create_rule(
        test_user.id, "Rule 2", "habit.deleted", "log", {"log_message": "test"}
    )

    rules = await service.list_rules(test_user.id)
    assert len(rules) == 2


@pytest.mark.asyncio
async def test_toggle_rule(db_session: AsyncSession, test_user):
    service = AutomationService(db_session)
    rule = await service.create_rule(test_user.id, "Test", "habit.created", "log", {})
    assert rule.is_active is True

    toggled = await service.toggle_rule(rule.id, test_user.id, False)
    assert toggled.is_active is False

    # 비활성 규칙은 active_only=True에서 안 보임
    active_rules = await service.list_rules(test_user.id, active_only=True)
    assert len(active_rules) == 0


@pytest.mark.asyncio
async def test_delete_rule(db_session: AsyncSession, test_user):
    service = AutomationService(db_session)
    rule = await service.create_rule(test_user.id, "Del", "habit.created", "log", {})
    await service.delete_rule(rule.id)

    result = await service.get_rule(rule.id, test_user.id)
    assert result is None


@pytest.mark.asyncio
async def test_match_condition():
    assert (
        AutomationService._matches_condition(
            {"completed": True, "source": "chat"}, {"completed": True}
        )
        is True
    )
    assert AutomationService._matches_condition({"completed": True}, {}) is True
    assert AutomationService._matches_condition({}, {}) is True


@pytest.mark.asyncio
async def test_no_match_condition():
    assert AutomationService._matches_condition({"completed": False}, {"completed": True}) is False
    assert AutomationService._matches_condition({"source": "ui"}, {"source": "chat"}) is False


@pytest.mark.asyncio
async def test_handle_event_triggers_rule(db_session: AsyncSession, test_user):
    service = AutomationService(db_session)
    rule = await service.create_rule(
        test_user.id,
        "체크인 알림",
        "habit.checkin_completed",
        "notification",
        {"message": "완료!"},
        trigger_condition={"completed": True},
    )

    event = DomainEvent(
        event_type="habit.checkin_completed",
        source="habit",
        payload={"completed": True, "habit_id": "123"},
        user_id=str(test_user.id),
    )
    await service.handle_event(event)

    # 실행 카운트 확인
    updated = await service.get_rule(rule.id, test_user.id)
    assert updated.execution_count == 1


@pytest.mark.asyncio
async def test_inactive_rule_skipped(db_session: AsyncSession, test_user):
    service = AutomationService(db_session)
    rule = await service.create_rule(
        test_user.id,
        "비활성",
        "habit.checkin_completed",
        "notification",
        {"message": "test"},
    )
    await service.toggle_rule(rule.id, test_user.id, False)

    event = DomainEvent(
        event_type="habit.checkin_completed",
        source="habit",
        payload={},
        user_id=str(test_user.id),
    )
    await service.handle_event(event)

    # toggle로 비활성 → get_rule은 직접 repo.get 사용해야 함
    updated_rule = await service.rule_repo.get(rule.id)
    assert updated_rule.execution_count == 0


@pytest.mark.asyncio
async def test_execution_count_increment(db_session: AsyncSession, test_user):
    service = AutomationService(db_session)
    rule = await service.create_rule(
        test_user.id,
        "카운트",
        "goal.created",
        "log",
        {"log_message": "목표 생성"},
    )

    for _ in range(3):
        event = DomainEvent(
            event_type="goal.created",
            source="growth",
            payload={"goal_id": "abc"},
            user_id=str(test_user.id),
        )
        await service.handle_event(event)

    updated = await service.rule_repo.get(rule.id)
    assert updated.execution_count == 3


@pytest.mark.asyncio
async def test_suggest_automations(db_session: AsyncSession, test_user):
    mock_llm = MagicMock()
    mock_llm.complete = AsyncMock(
        return_value=MagicMock(
            content='[{"name":"습관 알림","description":"체크인 시 알림","trigger_event":"habit.checkin_completed","trigger_condition":{},"action_type":"notification","action_config":{"message":"잘했어요!"}}]'
        )
    )
    service = AutomationService(db_session, llm=mock_llm)

    # 이벤트 5개 이상 필요 → EventStore에 직접 추가
    from alma.core.events.store import EventStoreRepository

    store = EventStoreRepository(db_session)
    for i in range(6):
        await store.append(
            DomainEvent(
                event_type="habit.checkin_completed",
                source="habit",
                payload={"completed": True},
                user_id=str(test_user.id),
            )
        )

    suggestions = await service.suggest_automations(test_user.id)
    assert len(suggestions) == 1
    assert suggestions[0]["name"] == "습관 알림"
