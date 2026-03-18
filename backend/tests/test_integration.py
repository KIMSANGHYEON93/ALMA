import pytest
from unittest.mock import AsyncMock

from alma.services.integration import IntegrationService


@pytest.mark.asyncio
async def test_detect_action_intent(db_session):
    mock_llm = AsyncMock()
    mock_llm.complete.return_value = type(
        "R",
        (),
        {
            "content": '{"service":"calendar","action":"create_event",'
            '"params":{"title":"Team meeting","date":"2026-03-18","time":"14:00"},'
            '"needs_confirmation":true}'
        },
    )()

    service = IntegrationService(db_session, mock_llm)
    intent = await service.detect_action_intent("Please schedule a team meeting tomorrow at 2pm")

    assert intent is not None
    assert intent.service == "calendar"
    assert intent.needs_confirmation is True


@pytest.mark.asyncio
async def test_detect_no_intent(db_session):
    mock_llm = AsyncMock()
    mock_llm.complete.return_value = type("R", (), {"content": "null"})()

    service = IntegrationService(db_session, mock_llm)
    intent = await service.detect_action_intent("What's the weather like?")

    assert intent is None
