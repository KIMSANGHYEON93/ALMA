import uuid
from datetime import datetime

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from alma.core.events.models import DomainEvent
from alma.models.models import Event


class EventStoreRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def append(self, event: DomainEvent) -> Event:
        db_event = Event(
            id=uuid.UUID(event.id),
            event_type=event.event_type,
            source=event.source,
            payload=event.payload,
            aggregate_id=uuid.UUID(event.aggregate_id) if event.aggregate_id else None,
            user_id=uuid.UUID(event.user_id) if event.user_id else None,
            trace_id=uuid.UUID(event.trace_id) if event.trace_id else None,
        )
        self.session.add(db_event)
        await self.session.commit()
        return db_event

    async def query_by_type(
        self, event_type: str, since: datetime, limit: int = 100
    ) -> list[Event]:
        result = await self.session.execute(
            select(Event)
            .where(Event.event_type == event_type, Event.created_at >= since)
            .order_by(desc(Event.created_at))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def query_by_user(
        self, user_id: uuid.UUID, since: datetime, limit: int = 100
    ) -> list[Event]:
        result = await self.session.execute(
            select(Event)
            .where(Event.user_id == user_id, Event.created_at >= since)
            .order_by(desc(Event.created_at))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def query_by_aggregate(self, aggregate_id: uuid.UUID) -> list[Event]:
        result = await self.session.execute(
            select(Event).where(Event.aggregate_id == aggregate_id).order_by(Event.created_at)
        )
        return list(result.scalars().all())


class EventStoreHandler:
    """글로벌 핸들러: 모든 이벤트를 DB에 저장"""

    def __init__(self, session_factory):
        self.session_factory = session_factory

    async def handle(self, event: DomainEvent) -> None:
        async with self.session_factory() as session:
            repo = EventStoreRepository(session)
            await repo.append(event)
