from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from alma.gateway.models import UnifiedMessage, UnifiedResponse


def test_unified_message():
    msg = UnifiedMessage(channel="cli", user_id="abc", content="hello")
    assert msg.channel == "cli"
    assert msg.content == "hello"
    assert msg.conversation_id is None


def test_unified_response():
    resp = UnifiedResponse(content="hi", conversation_id="conv-1")
    assert resp.content == "hi"
    assert resp.conversation_id == "conv-1"


def test_unified_message_with_metadata():
    msg = UnifiedMessage(
        channel="telegram", user_id="u1", content="test", metadata={"chat_id": 123}
    )
    assert msg.metadata["chat_id"] == 123


@pytest.mark.asyncio
async def test_channel_service_creates_conversation(db_session: AsyncSession, test_user):
    """conversation_id 없으면 새 대화 생성 확인"""
    from alma.gateway.service import ChannelService

    channel_service = ChannelService(db_session)
    msg = UnifiedMessage(
        channel="test",
        user_id=str(test_user.id),
        content="hello",
    )

    # ChatService.process_message를 모킹
    with patch("alma.gateway.service.ChatService") as MockChat:
        mock_chat_instance = MagicMock()
        mock_chat_instance.process_message = AsyncMock(return_value="Hi there!")
        MockChat.return_value = mock_chat_instance

        result = await channel_service.process_message(msg)

    assert result.content == "Hi there!"
    assert result.conversation_id is not None  # 새 대화 생성됨


@pytest.mark.asyncio
async def test_channel_service_reuses_conversation(db_session: AsyncSession, test_user):
    """conversation_id 있으면 기존 대화 재사용"""
    from alma.gateway.service import ChannelService

    channel_service = ChannelService(db_session)
    msg = UnifiedMessage(
        channel="test",
        user_id=str(test_user.id),
        content="hello",
        conversation_id="existing-conv-id",
    )

    with patch("alma.gateway.service.ChatService") as MockChat:
        mock_chat_instance = MagicMock()
        mock_chat_instance.process_message = AsyncMock(return_value="Response")
        MockChat.return_value = mock_chat_instance

        result = await channel_service.process_message(msg)

    assert result.conversation_id == "existing-conv-id"


def test_cli_module_exists():
    """CLI 모듈이 임포트 가능한지 확인"""
    from alma.cli import chat, login, main

    assert callable(login)
    assert callable(chat)
    assert callable(main)
