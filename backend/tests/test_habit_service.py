# backend/tests/test_habit_service.py
import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.habit.repository import HabitLogRepository, HabitRepository
from alma.domain.habit.service import HabitService


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
        user_id=test_user.id,
        title="Active",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today(),
    )
    h2 = await repo.create(
        user_id=test_user.id,
        title="Paused",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today(),
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
        user_id=test_user.id,
        title="삭제 테스트",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today(),
    )
    await log_repo.upsert(
        habit_id=habit.id,
        user_id=test_user.id,
        log_date=date.today(),
        completed=True,
        source="ui",
    )
    await repo.delete(habit.id)
    logs = await log_repo.list_by_habit(habit.id, date.today() - timedelta(days=1), date.today())
    assert len(logs) == 0


@pytest.mark.asyncio
async def test_checkin_boolean(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    habit = await service.create_habit(
        test_user.id,
        "독서",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today(),
    )
    log = await service.checkin(habit.id, test_user.id, date.today(), completed=True, source="ui")
    assert log.completed is True
    assert log.source == "ui"


@pytest.mark.asyncio
async def test_checkin_with_value(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    habit = await service.create_habit(
        test_user.id,
        "물",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today(),
        target_value=8,
        target_unit="잔",
    )
    log = await service.checkin(
        habit.id,
        test_user.id,
        date.today(),
        completed=True,
        value=6,
        note="오늘은 6잔만",
        source="ui",
    )
    assert log.value == 6
    assert log.note == "오늘은 6잔만"


@pytest.mark.asyncio
async def test_checkin_upsert(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    habit = await service.create_habit(
        test_user.id,
        "운동",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today(),
    )
    log1 = await service.checkin(habit.id, test_user.id, date.today(), completed=False, source="ui")
    log2 = await service.checkin(
        habit.id, test_user.id, date.today(), completed=True, source="chat"
    )
    assert log1.id == log2.id
    assert log2.completed is True
    assert log2.source == "chat"


@pytest.mark.asyncio
async def test_checkin_owner_validation(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    habit = await service.create_habit(
        test_user.id,
        "독서",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today(),
    )
    other_user_id = uuid.uuid4()
    with pytest.raises(PermissionError):
        await service.checkin(habit.id, other_user_id, date.today(), completed=True, source="ui")


@pytest.mark.asyncio
async def test_is_scheduled_today(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    today = date.today()

    # daily — always scheduled
    h_daily = await service.create_habit(
        test_user.id,
        "daily",
        frequency_type="daily",
        frequency_value={},
        start_date=today,
    )
    assert HabitService.is_scheduled(h_daily, today) is True

    # specific_days — only on matching weekdays
    h_days = await service.create_habit(
        test_user.id,
        "days",
        frequency_type="specific_days",
        frequency_value={"days": [today.weekday()]},
        start_date=today,
    )
    assert HabitService.is_scheduled(h_days, today) is True
    tomorrow = today + timedelta(days=1)
    if tomorrow.weekday() != today.weekday():
        assert HabitService.is_scheduled(h_days, tomorrow) is False

    # times_per_week — always True
    h_times = await service.create_habit(
        test_user.id,
        "times",
        frequency_type="times_per_week",
        frequency_value={"times": 3},
        start_date=today,
    )
    assert HabitService.is_scheduled(h_times, today) is True

    # every_n_days — interval based on start_date
    h_every = await service.create_habit(
        test_user.id,
        "every",
        frequency_type="every_n_days",
        frequency_value={"interval": 2},
        start_date=today,
    )
    assert HabitService.is_scheduled(h_every, today) is True
    assert HabitService.is_scheduled(h_every, today + timedelta(days=1)) is False
    assert HabitService.is_scheduled(h_every, today + timedelta(days=2)) is True


@pytest.mark.asyncio
async def test_streak_daily(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    today = date.today()
    habit = await service.create_habit(
        test_user.id,
        "매일",
        frequency_type="daily",
        frequency_value={},
        start_date=today - timedelta(days=10),
    )
    # 3일 연속 체크인 (오늘, 어제, 그제)
    for i in range(3):
        await service.checkin(
            habit.id, test_user.id, today - timedelta(days=i), completed=True, source="ui"
        )
    streak = await service.get_streak(habit, today)
    assert streak == 3


@pytest.mark.asyncio
async def test_streak_specific_days(db_session: AsyncSession, test_user):
    """월수금 습관: 화목은 스킵, 월수만 체크인 → streak = 2"""
    service = HabitService(db_session)
    # 월요일 찾기
    today = date.today()
    days_since_monday = today.weekday()
    monday = today - timedelta(days=days_since_monday)

    habit = await service.create_habit(
        test_user.id,
        "월수금",
        frequency_type="specific_days",
        frequency_value={"days": [0, 2, 4]},  # 월, 수, 금
        start_date=monday - timedelta(days=7),
    )
    # 이번 주 월, 수 체크인
    await service.checkin(habit.id, test_user.id, monday, completed=True, source="ui")
    wed = monday + timedelta(days=2)
    await service.checkin(habit.id, test_user.id, wed, completed=True, source="ui")

    streak = await service.get_streak(habit, wed)
    assert streak == 2  # 수, 월 연속 (화는 쉬는 날이라 스킵)


@pytest.mark.asyncio
async def test_streak_times_per_week(db_session: AsyncSession, test_user):
    """주 3회 습관: 고정 날짜로 2주 연속 달성 → streak = 2주"""
    service = HabitService(db_session)
    # 고정 날짜 사용 (테스트 안정성)
    # 2026-03-09 = 월요일
    this_monday = date(2026, 3, 16)
    last_monday = date(2026, 3, 9)
    as_of = date(2026, 3, 18)  # 수요일 — 이번 주 이미 3회 달성

    habit = await service.create_habit(
        test_user.id,
        "주3",
        frequency_type="times_per_week",
        frequency_value={"times": 3},
        start_date=date(2026, 3, 2),
    )
    # 지난 주 3회 (월, 화, 수)
    for i in range(3):
        await service.checkin(
            habit.id,
            test_user.id,
            last_monday + timedelta(days=i),
            completed=True,
            source="ui",
        )
    # 이번 주 3회 (월, 화, 수)
    for i in range(3):
        await service.checkin(
            habit.id,
            test_user.id,
            this_monday + timedelta(days=i),
            completed=True,
            source="ui",
        )

    streak = await service.get_streak(habit, as_of)
    assert streak == 2


@pytest.mark.asyncio
async def test_streak_every_n_days(db_session: AsyncSession, test_user):
    """격일 습관: 0일, 2일, 4일 체크인 → streak = 3"""
    service = HabitService(db_session)
    today = date.today()
    start = today - timedelta(days=10)

    habit = await service.create_habit(
        test_user.id,
        "격일",
        frequency_type="every_n_days",
        frequency_value={"interval": 2},
        start_date=start,
    )
    # start로부터 0, 2, 4일째 체크인 (최근 3개 예정일)
    for offset in [4, 6, 8]:
        d = start + timedelta(days=offset)
        await service.checkin(habit.id, test_user.id, d, completed=True, source="ui")

    as_of = start + timedelta(days=8)
    streak = await service.get_streak(habit, as_of)
    assert streak == 3


@pytest.mark.asyncio
async def test_streak_broken(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    today = date.today()
    habit = await service.create_habit(
        test_user.id,
        "매일",
        frequency_type="daily",
        frequency_value={},
        start_date=today - timedelta(days=10),
    )
    # 오늘, 어제 체크인, 그제 누락
    await service.checkin(habit.id, test_user.id, today, completed=True, source="ui")
    await service.checkin(
        habit.id, test_user.id, today - timedelta(days=1), completed=True, source="ui"
    )
    # today-2 는 누락
    streak = await service.get_streak(habit, today)
    assert streak == 2


@pytest.mark.asyncio
async def test_today_summary(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    today = date.today()

    # daily 습관 2개
    h1 = await service.create_habit(
        test_user.id,
        "물",
        frequency_type="daily",
        frequency_value={},
        start_date=today,
    )
    await service.create_habit(
        test_user.id,
        "운동",
        frequency_type="daily",
        frequency_value={},
        start_date=today,
    )
    # h1만 체크인
    await service.checkin(h1.id, test_user.id, today, completed=True, source="ui")

    summary = await service.get_today_summary(test_user.id)
    assert summary["date"] == today.isoformat()
    assert summary["total"] == 2
    assert summary["completed"] == 1
    assert len(summary["habits"]) == 2
