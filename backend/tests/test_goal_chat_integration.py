from unittest.mock import MagicMock

import pytest

from alma.domain.chat.service import ChatService
from alma.domain.growth.service import GoalService


@pytest.mark.asyncio
async def test_chat_without_goal_service(db_session):
    """기존 동작: goal_service=None이면 에러 없이 동작"""
    mock_llm = MagicMock()
    service = ChatService(db_session, mock_llm, goal_service=None)
    assert service.goal_service is None


@pytest.mark.asyncio
async def test_chat_with_goal_service(db_session, test_user):
    """GoalService 주입 시 목표 컨텍스트 생성 확인"""
    goal_service = GoalService(db_session)
    await goal_service.create_goal(test_user.id, "Learn Python", category="learning")

    context = await goal_service.get_active_goals_context(str(test_user.id))
    assert "Learn Python" in context
    assert "learning" in context

    # ChatService에 GoalService 주입 가능 확인
    mock_llm = MagicMock()
    chat = ChatService(db_session, mock_llm, goal_service=goal_service)
    assert chat.goal_service is not None


@pytest.mark.asyncio
async def test_goal_context_limit(db_session, test_user):
    """활성 목표 5개 제한 확인"""
    goal_service = GoalService(db_session)
    for i in range(7):
        await goal_service.create_goal(test_user.id, f"Goal {i}", category="personal")

    context = await goal_service.get_active_goals_context(str(test_user.id), limit=5)
    lines = [line for line in context.split("\n") if line.startswith("- ")]
    assert len(lines) == 5
