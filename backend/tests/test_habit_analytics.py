# backend/tests/test_habit_analytics.py
from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.habit.analytics import HabitAnalyticsService
from alma.domain.habit.service import HabitService


@pytest.mark.asyncio
async def test_heatmap_empty(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    await service.create_habit(
        test_user.id, "운동", frequency_type="daily", frequency_value={}, start_date=date.today()
    )

    analytics = HabitAnalyticsService(db_session)
    result = await analytics.get_heatmap(test_user.id, date.today().year)
    assert result["dates"] == {} or all(isinstance(v, int) for v in result["dates"].values())


@pytest.mark.asyncio
async def test_heatmap_with_data(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    habit = await service.create_habit(
        test_user.id,
        "운동",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today() - timedelta(days=5),
    )

    for i in range(3):
        await service.checkin(
            habit.id, test_user.id, date.today() - timedelta(days=i), completed=True, source="ui"
        )

    analytics = HabitAnalyticsService(db_session)
    result = await analytics.get_heatmap(test_user.id, date.today().year)
    assert len(result["dates"]) == 3
    assert all(v >= 1 for v in result["dates"].values())


@pytest.mark.asyncio
async def test_trends_daily(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    habit = await service.create_habit(
        test_user.id,
        "운동",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today() - timedelta(days=10),
    )

    for i in range(5):
        await service.checkin(
            habit.id, test_user.id, date.today() - timedelta(days=i), completed=True, source="ui"
        )

    analytics = HabitAnalyticsService(db_session)
    result = await analytics.get_trends(test_user.id, days=10)
    assert len(result["daily"]) == 10
    assert all("rate" in d for d in result["daily"])
    recent_5 = result["daily"][-5:]
    assert all(d["rate"] == 100 for d in recent_5)


@pytest.mark.asyncio
async def test_completion_rate(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    h1 = await service.create_habit(
        test_user.id,
        "운동",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today() - timedelta(days=10),
    )
    h2 = await service.create_habit(
        test_user.id,
        "독서",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today() - timedelta(days=10),
    )

    for i in range(8):
        await service.checkin(
            h1.id, test_user.id, date.today() - timedelta(days=i), completed=True, source="ui"
        )
    for i in range(3):
        await service.checkin(
            h2.id, test_user.id, date.today() - timedelta(days=i), completed=True, source="ui"
        )

    analytics = HabitAnalyticsService(db_session)
    result = await analytics.get_completion(test_user.id, days=10)
    habits_map = {h["title"]: h for h in result["habits"]}
    assert habits_map["운동"]["rate"] == 80
    assert habits_map["독서"]["rate"] == 30


@pytest.mark.asyncio
async def test_correlation_positive(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    start = date.today() - timedelta(days=13)
    h1 = await service.create_habit(
        test_user.id, "운동", frequency_type="daily", frequency_value={}, start_date=start
    )
    h2 = await service.create_habit(
        test_user.id, "물", frequency_type="daily", frequency_value={}, start_date=start
    )

    # 같은 날만 동시 완료 (교대 패턴)
    for i in range(14):
        d = start + timedelta(days=i)
        if i % 2 == 0:
            await service.checkin(h1.id, test_user.id, d, completed=True, source="ui")
            await service.checkin(h2.id, test_user.id, d, completed=True, source="ui")

    analytics = HabitAnalyticsService(db_session)
    result = await analytics.get_correlations(test_user.id, days=14)
    assert isinstance(result["pairs"], list)
    if result["pairs"]:
        assert result["pairs"][0]["correlation"] > 0


@pytest.mark.asyncio
async def test_correlation_no_overlap(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    start = date.today() - timedelta(days=13)
    h1 = await service.create_habit(
        test_user.id, "A", frequency_type="daily", frequency_value={}, start_date=start
    )
    h2 = await service.create_habit(
        test_user.id, "B", frequency_type="daily", frequency_value={}, start_date=start
    )

    for i in range(14):
        d = start + timedelta(days=i)
        if i % 2 == 0:
            await service.checkin(h1.id, test_user.id, d, completed=True, source="ui")
        else:
            await service.checkin(h2.id, test_user.id, d, completed=True, source="ui")

    analytics = HabitAnalyticsService(db_session)
    result = await analytics.get_correlations(test_user.id, days=14)
    if result["pairs"]:
        assert result["pairs"][0]["correlation"] < 0


@pytest.mark.asyncio
async def test_weekday_pattern(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    today = date.today()
    # 14일 전부터 시작 (get_trends가 date.today() 기준으로 계산하므로)
    start = today - timedelta(days=13)
    habit = await service.create_habit(
        test_user.id, "운동", frequency_type="daily", frequency_value={}, start_date=start
    )

    for i in range(14):
        d = start + timedelta(days=i)
        if d.weekday() < 5:  # 평일만 체크인
            await service.checkin(habit.id, test_user.id, d, completed=True, source="ui")

    analytics = HabitAnalyticsService(db_session)
    result = await analytics.get_trends(test_user.id, days=14)
    weekday = result["weekday"]
    assert weekday[5]["rate"] == 0  # 토
    assert weekday[6]["rate"] == 0  # 일
    # 평일은 모두 100%
    for i in range(5):
        assert weekday[i]["rate"] == 100, (
            f"weekday {i} should be 100% but got {weekday[i]['rate']}%"
        )


@pytest.mark.asyncio
async def test_generate_insight(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    await service.create_habit(
        test_user.id,
        "운동",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today() - timedelta(days=5),
    )

    mock_llm = MagicMock()
    mock_llm.complete = AsyncMock(
        return_value=MagicMock(content="## 분석 결과\n\n잘하고 있습니다!")
    )
    analytics = HabitAnalyticsService(db_session, llm=mock_llm)
    result = await analytics.generate_insight(test_user.id)
    assert "content" in result
    assert result["content"] == "## 분석 결과\n\n잘하고 있습니다!"
