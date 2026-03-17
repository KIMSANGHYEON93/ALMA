import pytest
from unittest.mock import AsyncMock, patch

from alma.llm.base import LLMResponse
from alma.models.models import Conversation, User
from alma.services.chat import ChatService


@pytest.mark.asyncio
async def test_process_message(db_session):
    user = User(email="chat@test.com", password_hash="hashed")
    db_session.add(user)
    await db_session.flush()
    conv = Conversation(user_id=user.id, title="Test")
    db_session.add(conv)
    await db_session.flush()

    mock_llm = AsyncMock()
    mock_llm.complete.return_value = LLMResponse(
        content="I'll help you with that!",
        model="test",
        input_tokens=10,
        output_tokens=5,
    )

    service = ChatService(session=db_session, llm=mock_llm)

    with patch.object(
        service.memory,
        "_get_embedding",
        new_callable=AsyncMock,
        return_value=[0.1] * 1536,
    ):
        with patch.object(
            service.memory,
            "search_similar",
            new_callable=AsyncMock,
            return_value=[],
        ):
            with patch.object(
                service.integration,
                "detect_action_intent",
                new_callable=AsyncMock,
                return_value=None,
            ):
                response = await service.process_message(
                    user_id=str(user.id),
                    conversation_id=str(conv.id),
                    content="Help me",
                )

    assert "I'll help you with that!" in response
    mock_llm.complete.assert_called_once()
