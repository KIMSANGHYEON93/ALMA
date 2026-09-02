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


def test_create_llm_router_is_cached_per_key_set():
    """같은 키 조합이면 프로바이더를 새로 만들지 않는다.

    회귀 방지: LLM 클라이언트 생성자는 ssl.SSLContext(CA 번들 파싱)를 매번 만들며
    수 초가 걸린다. WebSocket 연결마다 이를 반복하면 asyncio 이벤트 루프가 막혀
    같은 프로세스의 다른 HTTP 요청(대화 rename PATCH / delete DELETE)이 멈춘다.
    """
    from alma.api.llm import create_llm_router

    first = create_llm_router(user_prefs=None)
    second = create_llm_router(user_prefs=None)
    assert first is second

    other = create_llm_router(user_prefs={"anthropic_api_key": "user-specific-key"})
    assert other is not first
    assert create_llm_router(user_prefs={"anthropic_api_key": "user-specific-key"}) is other


def test_create_embedding_provider_is_cached_per_key_set():
    """임베딩 프로바이더도 동일 이유로 키 조합별 1회만 생성되어야 한다."""
    from unittest.mock import MagicMock as _MagicMock

    from alma.domain.memory.embedding import create_embedding_provider

    settings_a = _MagicMock()
    settings_a.gemini_api_key = ""
    settings_a.openai_api_key = ""
    assert create_embedding_provider(settings_a) is create_embedding_provider(settings_a)
