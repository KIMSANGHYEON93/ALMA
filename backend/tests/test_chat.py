import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from alma.infrastructure.llm.base import LLMStreamChunk
from alma.models.models import Conversation, User
from alma.domain.chat.service import ChatService


async def _mock_stream(*_args, **_kwargs):
    """Async iterator mock yielding a single-chunk response."""
    yield LLMStreamChunk(delta="I'll help you with that!", is_final=False)
    yield LLMStreamChunk(
        delta="",
        is_final=True,
        input_tokens=10,
        output_tokens=5,
        model="test",
    )


@pytest.mark.asyncio
async def test_process_message(db_session):
    user = User(email="chat@test.com", password_hash="hashed")
    db_session.add(user)
    await db_session.flush()
    conv = Conversation(user_id=user.id, title="Test")
    db_session.add(conv)
    await db_session.flush()

    # Mock LLM with stream() returning async generator
    mock_llm = MagicMock()
    mock_llm.stream = MagicMock(side_effect=lambda *a, **kw: _mock_stream())

    service = ChatService(session=db_session, llm=mock_llm)

    with patch.object(
        service.memory, "_get_embedding", new_callable=AsyncMock, return_value=[0.1] * 768
    ):
        with patch.object(
            service.memory, "search_similar", new_callable=AsyncMock, return_value=[]
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
    mock_llm.stream.assert_called_once()
