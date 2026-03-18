import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from alma.infrastructure.llm.base import ChatMessage, LLMRequest, LLMResponse
from alma.infrastructure.llm.claude import ClaudeProvider


def test_llm_request_creation():
    msg = ChatMessage(role="user", content="Hello")
    req = LLMRequest(messages=[msg])
    assert len(req.messages) == 1
    assert req.max_tokens == 4096
    assert req.temperature == 0.7


def test_llm_response_creation():
    resp = LLMResponse(content="Hi", model="test", input_tokens=5, output_tokens=3)
    assert resp.content == "Hi"
    assert resp.model == "test"


def test_chat_message_immutable():
    msg = ChatMessage(role="user", content="test")
    with pytest.raises(AttributeError):
        msg.role = "assistant"


@pytest.mark.asyncio
async def test_claude_provider_complete():
    provider = ClaudeProvider()

    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="Hello from Claude")]
    mock_response.model = "claude-3-haiku-20240307"
    mock_response.usage.input_tokens = 10
    mock_response.usage.output_tokens = 5

    with patch.object(
        provider.client.messages,
        "create",
        new_callable=AsyncMock,
        return_value=mock_response,
    ):
        req = LLMRequest(messages=[ChatMessage(role="user", content="Hi")])
        resp = await provider.complete(req)

    assert resp.content == "Hello from Claude"
    assert resp.input_tokens == 10
