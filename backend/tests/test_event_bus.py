import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from alma.core.events.bus import InMemoryEventBus
from alma.core.events.models import DomainEvent
from alma.core.events.store import EventStoreRepository


def _make_event(event_type="test.event", source="test", user_id=None, aggregate_id=None):
    return DomainEvent(
        id=str(uuid.uuid4()),
        event_type=event_type,
        source=source,
        payload={"key": "value"},
        timestamp=datetime.now(timezone.utc),
        user_id=user_id,
        aggregate_id=aggregate_id,
    )


@pytest.mark.asyncio
async def test_publish_subscribe():
    bus = InMemoryEventBus()
    received = []
    bus.subscribe("test.event", AsyncMock(side_effect=lambda e: received.append(e)))
    event = _make_event()
    await bus.publish(event)
    assert len(received) == 1
    assert received[0].event_type == "test.event"


@pytest.mark.asyncio
async def test_subscribe_specific_type():
    bus = InMemoryEventBus()
    received_a = []
    received_b = []
    bus.subscribe("type.a", AsyncMock(side_effect=lambda e: received_a.append(e)))
    bus.subscribe("type.b", AsyncMock(side_effect=lambda e: received_b.append(e)))
    await bus.publish(_make_event(event_type="type.a"))
    assert len(received_a) == 1
    assert len(received_b) == 0


@pytest.mark.asyncio
async def test_subscribe_all():
    bus = InMemoryEventBus()
    received = []
    bus.subscribe_all(AsyncMock(side_effect=lambda e: received.append(e)))
    await bus.publish(_make_event(event_type="type.a"))
    await bus.publish(_make_event(event_type="type.b"))
    assert len(received) == 2


@pytest.mark.asyncio
async def test_handler_error_isolated():
    bus = InMemoryEventBus()
    success = []
    bus.subscribe("test.event", AsyncMock(side_effect=Exception("fail")))
    bus.subscribe("test.event", AsyncMock(side_effect=lambda e: success.append(e)))
    await bus.publish(_make_event())
    assert len(success) == 1


@pytest.mark.asyncio
async def test_event_store_append(db_session: AsyncSession):
    repo = EventStoreRepository(db_session)
    event = _make_event(user_id=str(uuid.uuid4()))
    db_event = await repo.append(event)
    assert db_event.event_type == "test.event"
    assert db_event.payload == {"key": "value"}


@pytest.mark.asyncio
async def test_event_store_query_by_type(db_session: AsyncSession):
    repo = EventStoreRepository(db_session)
    await repo.append(_make_event(event_type="chat.message"))
    await repo.append(_make_event(event_type="habit.checkin"))
    await repo.append(_make_event(event_type="chat.message"))

    since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=1)
    results = await repo.query_by_type("chat.message", since)
    assert len(results) == 2


@pytest.mark.asyncio
async def test_event_store_query_by_user(db_session: AsyncSession, test_user):
    repo = EventStoreRepository(db_session)
    await repo.append(_make_event(user_id=str(test_user.id)))
    await repo.append(_make_event(user_id=str(uuid.uuid4())))

    since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=1)
    results = await repo.query_by_user(test_user.id, since)
    assert len(results) == 1


@pytest.mark.asyncio
async def test_emit_helper(db_session: AsyncSession, test_user):
    from alma.core.events import event_bus

    received = []
    handler = AsyncMock(side_effect=lambda e: received.append(e))
    event_bus.subscribe("test.emit", handler)

    from alma.core.events.helpers import emit

    await emit("test.emit", "test", {"data": 123}, user_id=str(test_user.id))

    assert len(received) == 1
    assert received[0].payload == {"data": 123}
    event_bus._handlers.pop("test.emit", None)
