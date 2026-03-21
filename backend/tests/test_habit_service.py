# backend/tests/test_habit_service.py
import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.habit.models import FrequencyType, HabitStatus
from alma.domain.habit.repository import HabitLogRepository, HabitRepository
from alma.models.models import Habit


@pytest.mark.asyncio
async def test_create_habit(db_session: AsyncSession, test_user):
    repo = HabitRepository(db_session)
    habit = await repo.create(
        user_id=test_user.id,
        title="물 마시기",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today(),
    )
    assert habit.id is not None
    assert habit.title == "물 마시기"
    assert habit.status == "active"
    assert habit.start_date == date.today()


@pytest.mark.asyncio
async def test_create_habit_with_goal(db_session: AsyncSession, test_user):
    from alma.domain.growth.service import GoalService

    goal_service = GoalService(db_session)
    goal = await goal_service.create_goal(test_user.id, "건강")
    repo = HabitRepository(db_session)
    habit = await repo.create(
        user_id=test_user.id,
        title="운동",
        frequency_type="specific_days",
        frequency_value={"days": [0, 2, 4]},
        start_date=date.today(),
        goal_id=goal.id,
    )
    assert habit.goal_id == goal.id


@pytest.mark.asyncio
async def test_list_habits_by_status(db_session: AsyncSession, test_user):
    repo = HabitRepository(db_session)
    await repo.create(
        user_id=test_user.id, title="Active", frequency_type="daily",
        frequency_value={}, start_date=date.today(),
    )
    h2 = await repo.create(
        user_id=test_user.id, title="Paused", frequency_type="daily",
        frequency_value={}, start_date=date.today(),
    )
    h2.status = "paused"
    await repo.update(h2)

    active = await repo.list_by_user(test_user.id, status="active")
    assert len(active) == 1
    assert active[0].title == "Active"

    all_habits = await repo.list_by_user(test_user.id)
    assert len(all_habits) == 2


@pytest.mark.asyncio
async def test_delete_habit_cascades_logs(db_session: AsyncSession, test_user):
    repo = HabitRepository(db_session)
    log_repo = HabitLogRepository(db_session)
    habit = await repo.create(
        user_id=test_user.id, title="삭제 테스트", frequency_type="daily",
        frequency_value={}, start_date=date.today(),
    )
    await log_repo.upsert(
        habit_id=habit.id, user_id=test_user.id,
        log_date=date.today(), completed=True, source="ui",
    )
    await repo.delete(habit.id)
    logs = await log_repo.list_by_habit(habit.id, date.today() - timedelta(days=1), date.today())
    assert len(logs) == 0
