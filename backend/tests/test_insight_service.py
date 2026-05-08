import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from alma.domain.growth.service import GoalService
from alma.domain.insight.models import InsightCategory
from alma.domain.insight.service import InsightService


@pytest.mark.asyncio
async def test_insight_categories():
    assert InsightCategory.TOPIC_TREND == "topic_trend"
    assert InsightCategory.RECOMMENDATION == "recommendation"


@pytest.mark.asyncio
async def test_empty_week_no_llm_call(db_session, test_user):
    """빈 주: LLM 호출 없이 기본 템플릿 저장"""
    mock_llm = MagicMock()
    mock_llm.complete = AsyncMock()
    service = InsightService(db_session, mock_llm)
    retro = await service.generate_weekly_retrospective(test_user.id)
    assert "활동이 없었습니다" in retro.summary
    assert retro.conversation_count == 0
    mock_llm.complete.assert_not_called()


@pytest.mark.asyncio
async def test_duplicate_week_returns_existing(db_session, test_user):
    """같은 주 중복 생성 시 기존 회고 반환"""
    mock_llm = MagicMock()
    mock_llm.complete = AsyncMock()
    service = InsightService(db_session, mock_llm)
    retro1 = await service.generate_weekly_retrospective(test_user.id)
    retro2 = await service.generate_weekly_retrospective(test_user.id)
    assert retro1.id == retro2.id


@pytest.mark.asyncio
async def test_retro_with_goals(db_session, test_user):
    """GoalService 연동 — 목표 스냅샷 포함"""
    mock_llm = MagicMock()
    mock_llm.complete = AsyncMock()
    goal_service = GoalService(db_session)
    await goal_service.create_goal(test_user.id, "Test Goal")
    service = InsightService(db_session, mock_llm, goal_service)
    retro = await service.generate_weekly_retrospective(test_user.id)
    assert retro.goals_progress.get("active_goals", 0) >= 1


@pytest.mark.asyncio
async def test_dashboard(db_session, test_user):
    """대시보드 API 데이터 구조"""
    mock_llm = MagicMock()
    service = InsightService(db_session, mock_llm)
    dashboard = await service.get_dashboard(test_user.id)
    assert "stats" in dashboard
    assert "streak_days" in dashboard["stats"]
    assert "recent_insights" in dashboard
    assert dashboard["latest_retrospective"] is None  # 아직 없음


@pytest.mark.asyncio
async def test_dashboard_with_retro(db_session, test_user):
    """회고 생성 후 대시보드에 표시"""
    mock_llm = MagicMock()
    mock_llm.complete = AsyncMock()
    service = InsightService(db_session, mock_llm)
    await service.generate_weekly_retrospective(test_user.id)
    dashboard = await service.get_dashboard(test_user.id)
    assert dashboard["latest_retrospective"] is not None
    assert "summary" in dashboard["latest_retrospective"]


@pytest.mark.asyncio
async def test_json_parse_fallback(db_session, test_user):
    """LLM이 잘못된 JSON 반환 시 폴백"""
    mock_llm = MagicMock()
    mock_llm.complete = AsyncMock(return_value=MagicMock(content="This is not valid JSON at all"))

    # 메시지가 있어야 LLM 호출됨 — 직접 Retro repo에 메시지 생성
    from alma.models.models import Conversation, Message

    conv = Conversation(user_id=test_user.id, title="test")
    db_session.add(conv)
    await db_session.commit()
    await db_session.refresh(conv)
    msg = Message(conversation_id=conv.id, role="user", content="hello")
    db_session.add(msg)
    await db_session.commit()

    service = InsightService(db_session, mock_llm)
    retro = await service.generate_weekly_retrospective(test_user.id)
    assert retro.summary  # 폴백 summary 존재
    assert retro.highlights == []


@pytest.mark.asyncio
async def test_retro_list(db_session, test_user):
    """회고 목록 조회"""
    mock_llm = MagicMock()
    mock_llm.complete = AsyncMock()
    service = InsightService(db_session, mock_llm)
    await service.generate_weekly_retrospective(test_user.id)
    retros = await service.list_retrospectives(test_user.id)
    assert len(retros) >= 1
    assert "period_start" in retros[0]


@pytest.mark.asyncio
async def test_ownership_check(db_session, test_user):
    """소유권 검증 — 다른 사용자 회고 접근 불가"""
    mock_llm = MagicMock()
    mock_llm.complete = AsyncMock()
    service = InsightService(db_session, mock_llm)
    retro = await service.generate_weekly_retrospective(test_user.id)
    other_id = uuid.uuid4()
    result = await service.get_retrospective_detail(retro.id, other_id)
    assert result is None
