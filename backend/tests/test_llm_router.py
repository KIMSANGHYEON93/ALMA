from unittest.mock import AsyncMock, MagicMock

import pytest

from alma.infrastructure.llm.base import ChatMessage, LLMRequest, LLMResponse
from alma.infrastructure.llm.router import LLMRouter


def _mock_provider(name: str, fail: bool = False):
    provider = MagicMock()
    if fail:
        provider.complete = AsyncMock(side_effect=Exception(f"{name} failed"))
    else:
        provider.complete = AsyncMock(
            return_value=LLMResponse(
                content=f"Response from {name}",
                model=name,
                input_tokens=10,
                output_tokens=20,
            )
        )
    return provider


def _make_request():
    return LLMRequest(
        messages=[ChatMessage(role="user", content="Hello")],
    )


@pytest.mark.asyncio
async def test_router_default():
    router = LLMRouter(
        providers={"claude": _mock_provider("claude"), "openai": _mock_provider("openai")},
        default="claude",
    )
    response = await router.complete(_make_request())
    assert response.content == "Response from claude"
    assert response.model == "claude"


@pytest.mark.asyncio
async def test_router_specific_provider():
    router = LLMRouter(
        providers={"claude": _mock_provider("claude"), "openai": _mock_provider("openai")},
        default="claude",
    )
    response = await router.complete(_make_request(), provider_name="openai")
    assert response.content == "Response from openai"


@pytest.mark.asyncio
async def test_router_fallback():
    router = LLMRouter(
        providers={
            "claude": _mock_provider("claude", fail=True),
            "openai": _mock_provider("openai"),
        },
        default="claude",
    )
    response = await router.complete(_make_request())
    assert response.content == "Response from openai"


@pytest.mark.asyncio
async def test_router_all_fail():
    router = LLMRouter(
        providers={
            "claude": _mock_provider("claude", fail=True),
            "openai": _mock_provider("openai", fail=True),
        },
        default="claude",
    )
    with pytest.raises(Exception):
        await router.complete(_make_request())


@pytest.mark.asyncio
async def test_router_unknown_provider_falls_back():
    router = LLMRouter(
        providers={"claude": _mock_provider("claude")},
        default="claude",
    )
    response = await router.complete(_make_request(), provider_name="unknown")
    assert response.content == "Response from claude"


@pytest.mark.asyncio
async def test_list_available():
    router = LLMRouter(
        providers={
            "claude": _mock_provider("claude"),
            "openai": _mock_provider("openai"),
            "gemini": _mock_provider("gemini"),
        },
        default="claude",
    )
    models = router.list_available()
    assert set(models) == {"claude", "openai", "gemini"}
