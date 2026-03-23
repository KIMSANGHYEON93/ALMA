# backend/tests/test_habit_chat_integration.py
from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.habit.service import HabitService
from alma.domain.integration.service import ActionIntent, IntegrationService


@pytest.mark.asyncio
async def test_find_by_title_single_match(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    await service.create_habit(
        test_user.id,
        "운동하기",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today(),
    )
    await service.create_habit(
        test_user.id,
        "독서하기",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today(),
    )

    matches = await service.find_by_title(test_user.id, "운동")
    assert len(matches) == 1
    assert matches[0].title == "운동하기"


@pytest.mark.asyncio
async def test_find_by_title_multiple_matches(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    await service.create_habit(
        test_user.id,
        "물 마시기",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today(),
    )
    await service.create_habit(
        test_user.id,
        "커피 마시기",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today(),
    )

    matches = await service.find_by_title(test_user.id, "마시")
    assert len(matches) == 2


@pytest.mark.asyncio
async def test_find_by_title_no_match(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    await service.create_habit(
        test_user.id,
        "운동하기",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today(),
    )

    matches = await service.find_by_title(test_user.id, "없는습관")
    assert len(matches) == 0


@pytest.mark.asyncio
async def test_habits_context_injection(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    await service.create_habit(
        test_user.id, "운동", frequency_type="daily", frequency_value={}, start_date=date.today()
    )

    ctx = await service.get_habits_context(test_user.id)
    assert "오늘의 습관" in ctx
    assert "운동" in ctx
    assert "⬜" in ctx  # 미완료


@pytest.mark.asyncio
async def test_detect_habit_checkin_intent(db_session: AsyncSession):
    """LLM 응답에서 habit.checkin 인텐트 감지"""
    mock_llm = MagicMock()
    mock_llm.complete = AsyncMock(
        return_value=MagicMock(
            content='{"service":"habit","action":"checkin","params":{"title":"운동"},"needs_confirmation":false}'
        )
    )
    service = IntegrationService(db_session, mock_llm)
    intent = await service.detect_action_intent("운동 했어요라고 말씀하셨네요")
    assert intent is not None
    assert intent.service == "habit"
    assert intent.action == "checkin"
    assert intent.params["title"] == "운동"
    assert intent.needs_confirmation is False


@pytest.mark.asyncio
async def test_detect_habit_create_intent(db_session: AsyncSession):
    """LLM 응답에서 habit.create 인텐트 감지 (needs_confirmation=true)"""
    mock_llm = MagicMock()
    mock_llm.complete = AsyncMock(
        return_value=MagicMock(
            content='{"service":"habit","action":"create","params":{"title":"물 마시기","frequency_type":"daily","frequency_value":{}},"needs_confirmation":true}'
        )
    )
    service = IntegrationService(db_session, mock_llm)
    intent = await service.detect_action_intent("물 마시기 습관을 추가해드릴까요?")
    assert intent is not None
    assert intent.service == "habit"
    assert intent.action == "create"
    assert intent.needs_confirmation is True


@pytest.mark.asyncio
async def test_checkin_via_chat(db_session: AsyncSession, test_user):
    habit_service = HabitService(db_session)
    habit = await habit_service.create_habit(
        test_user.id,
        "운동하기",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today(),
    )

    mock_llm = MagicMock()
    integration_service = IntegrationService(db_session, mock_llm, habit_service=habit_service)

    intent = ActionIntent(
        service="habit", action="checkin", params={"title": "운동"}, needs_confirmation=False
    )
    result = await integration_service.execute_action(str(test_user.id), intent)

    assert result["success"] is True
    assert result["habit"] == "운동하기"
    assert "streak" in result

    # source가 "chat"인지 확인
    from alma.domain.habit.repository import HabitLogRepository

    log_repo = HabitLogRepository(db_session)
    log = await log_repo.get_by_date(habit.id, date.today())
    assert log is not None
    assert log.source == "chat"
    assert log.completed is True


@pytest.mark.asyncio
async def test_uncheckin_via_chat(db_session: AsyncSession, test_user):
    habit_service = HabitService(db_session)
    habit = await habit_service.create_habit(
        test_user.id,
        "운동하기",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today(),
    )
    await habit_service.checkin(habit.id, test_user.id, date.today(), completed=True, source="ui")

    mock_llm = MagicMock()
    integration_service = IntegrationService(db_session, mock_llm, habit_service=habit_service)

    intent = ActionIntent(
        service="habit", action="uncheckin", params={"title": "운동"}, needs_confirmation=False
    )
    result = await integration_service.execute_action(str(test_user.id), intent)

    assert result["success"] is True
    assert result["unchecked"] is True


@pytest.mark.asyncio
async def test_create_habit_via_intent(db_session: AsyncSession, test_user):
    habit_service = HabitService(db_session)
    mock_llm = MagicMock()
    integration_service = IntegrationService(db_session, mock_llm, habit_service=habit_service)

    intent = ActionIntent(
        service="habit",
        action="create",
        params={
            "title": "물 마시기",
            "frequency_type": "daily",
            "frequency_value": {},
            "start_date": str(date.today()),
        },
        needs_confirmation=True,
    )
    result = await integration_service.execute_action(str(test_user.id), intent)

    assert result["success"] is True
    assert result["created"] is True

    habits = await habit_service.list_habits(test_user.id, status="active")
    assert any(h.title == "물 마시기" for h in habits)
