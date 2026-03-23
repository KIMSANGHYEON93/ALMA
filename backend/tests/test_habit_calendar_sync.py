from datetime import date

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.habit.calendar_sync import HabitCalendarSync
from alma.domain.habit.service import HabitService
from alma.domain.integration.repository import IntegrationRepository


def test_frequency_to_rrule():
    assert HabitCalendarSync.frequency_to_rrule("daily", {}) == "RRULE:FREQ=DAILY"
    assert (
        HabitCalendarSync.frequency_to_rrule("specific_days", {"days": [0, 2, 4]})
        == "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"
    )
    assert (
        HabitCalendarSync.frequency_to_rrule("times_per_week", {"times": 3})
        == "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"
    )
    assert (
        HabitCalendarSync.frequency_to_rrule("every_n_days", {"interval": 2})
        == "RRULE:FREQ=DAILY;INTERVAL=2"
    )
    assert (
        HabitCalendarSync.frequency_to_rrule("specific_days", {"days": [1, 3, 5]})
        == "RRULE:FREQ=WEEKLY;BYDAY=TU,TH,SA"
    )
    assert (
        HabitCalendarSync.frequency_to_rrule("times_per_week", {"times": 5})
        == "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
    )


@pytest.mark.asyncio
async def test_sync_to_calendar(db_session: AsyncSession, test_user):
    habit_service = HabitService(db_session)
    habit = await habit_service.create_habit(
        test_user.id,
        "운동",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today(),
    )

    integration_repo = IntegrationRepository(db_session)
    sync = HabitCalendarSync(db_session, integration_repo)

    # Integration이 없으면 None 반환
    result = await sync.sync_to_calendar(habit, test_user.id)
    assert result is None
    assert habit.calendar_event_id is None


@pytest.mark.asyncio
async def test_remove_from_calendar_no_event(db_session: AsyncSession, test_user):
    habit_service = HabitService(db_session)
    habit = await habit_service.create_habit(
        test_user.id,
        "운동",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today(),
    )

    integration_repo = IntegrationRepository(db_session)
    sync = HabitCalendarSync(db_session, integration_repo)

    # calendar_event_id가 None이면 아무것도 안 함
    await sync.remove_from_calendar(habit, test_user.id)
    assert habit.calendar_event_id is None


@pytest.mark.asyncio
async def test_sync_without_integration(db_session: AsyncSession, test_user):
    """캘린더 미연동 시 None 반환 (graceful)"""
    habit_service = HabitService(db_session)
    habit = await habit_service.create_habit(
        test_user.id,
        "운동",
        frequency_type="specific_days",
        frequency_value={"days": [0, 2, 4]},
        start_date=date.today(),
    )

    integration_repo = IntegrationRepository(db_session)
    sync = HabitCalendarSync(db_session, integration_repo)

    result = await sync.sync_to_calendar(habit, test_user.id)
    assert result is None


@pytest.mark.asyncio
async def test_delete_habit_calendar_cleanup(db_session: AsyncSession, test_user):
    """calendar_event_id가 있는 습관에서 remove 시 calendar_event_id null 처리"""
    habit_service = HabitService(db_session)
    habit = await habit_service.create_habit(
        test_user.id,
        "운동",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today(),
    )
    # calendar_event_id를 수동 설정
    habit.calendar_event_id = "mock_event_123"
    await db_session.commit()
    await db_session.refresh(habit)

    integration_repo = IntegrationRepository(db_session)
    sync = HabitCalendarSync(db_session, integration_repo)

    # Integration이 없어도 calendar_event_id는 None으로
    await sync.remove_from_calendar(habit, test_user.id)
    assert habit.calendar_event_id is None
