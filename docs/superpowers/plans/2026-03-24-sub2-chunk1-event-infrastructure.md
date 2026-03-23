# Sub-2 Chunk 1: Event Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DomainEvent + InMemoryEventBus + EventStore(PostgreSQL) + 기존 서비스 이벤트 발행 통합

**Architecture:** 인메모리 이벤트 버스(싱글톤) + PostgreSQL events 테이블. 글로벌 핸들러로 모든 이벤트 영속화. 기존 서비스에 fire-and-forget 이벤트 발행 추가.

**Tech Stack:** Python 3.14, FastAPI, SQLAlchemy 2.0 async, pytest-asyncio

**Spec:** `docs/superpowers/specs/2026-03-24-sub2-chunk1-event-infrastructure.md`

---

## File Structure

### Create
| File | Responsibility |
|------|---------------|
| `backend/src/alma/core/__init__.py` | 코어 패키지 |
| `backend/src/alma/core/events/__init__.py` | event_bus 싱글톤 |
| `backend/src/alma/core/events/models.py` | DomainEvent 데이터클래스 |
| `backend/src/alma/core/events/bus.py` | InMemoryEventBus |
| `backend/src/alma/core/events/store.py` | EventStoreRepository + EventStoreHandler |
| `backend/src/alma/core/events/helpers.py` | emit() 헬퍼 |
| `backend/tests/test_event_bus.py` | 8개 테스트 |

### Modify
| File | Change |
|------|--------|
| `backend/src/alma/models/models.py` | +Event ORM 모델 |
| `backend/src/alma/main.py` | +EventStoreHandler 등록 |
| `backend/src/alma/domain/chat/service.py` | +chat.message_processed 이벤트 |
| `backend/src/alma/domain/habit/service.py` | +habit.* 이벤트 3개 |
| `backend/src/alma/domain/integration/service.py` | +integration.action_executed 이벤트 |
| `backend/src/alma/domain/growth/service.py` | +goal.* 이벤트 2개 |
| Alembic migration | +events 테이블 |

---

## Task 1: Event 모델 + 이벤트 버스 + 이벤트 스토어 코어

**Files:** Create 6 files + Modify models.py + migration

- [ ] **Step 1: 코어 패키지 + DomainEvent + EventBus + Store 전부 생성**

`backend/src/alma/core/__init__.py` (빈 파일)

`backend/src/alma/core/events/models.py`:
```python
import uuid
from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class DomainEvent:
    event_type: str
    source: str
    payload: dict
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)
    aggregate_id: str | None = None
    user_id: str | None = None
    trace_id: str | None = None
```

`backend/src/alma/core/events/bus.py`:
```python
import logging
from collections.abc import Callable

from alma.core.events.models import DomainEvent

logger = logging.getLogger(__name__)


class InMemoryEventBus:
    def __init__(self):
        self._handlers: dict[str, list[Callable]] = {}
        self._global_handlers: list[Callable] = []

    async def publish(self, event: DomainEvent) -> None:
        for handler in self._handlers.get(event.event_type, []):
            try:
                await handler(event)
            except Exception:
                logger.warning("Handler failed for %s", event.event_type, exc_info=True)
        for handler in self._global_handlers:
            try:
                await handler(event)
            except Exception:
                logger.warning("Global handler failed", exc_info=True)

    def subscribe(self, event_type: str, handler: Callable) -> None:
        self._handlers.setdefault(event_type, []).append(handler)

    def subscribe_all(self, handler: Callable) -> None:
        self._global_handlers.append(handler)
```

`backend/src/alma/core/events/__init__.py`:
```python
from alma.core.events.bus import InMemoryEventBus

event_bus = InMemoryEventBus()
```

`backend/src/alma/core/events/helpers.py`:
```python
import uuid
from datetime import datetime

from alma.core.events import event_bus
from alma.core.events.models import DomainEvent


async def emit(
    event_type: str,
    source: str,
    payload: dict,
    user_id: str | None = None,
    aggregate_id: str | None = None,
    trace_id: str | None = None,
) -> None:
    await event_bus.publish(DomainEvent(
        id=str(uuid.uuid4()),
        event_type=event_type,
        source=source,
        payload=payload,
        timestamp=datetime.utcnow(),
        user_id=user_id,
        aggregate_id=aggregate_id,
        trace_id=trace_id,
    ))
```

`backend/src/alma/core/events/store.py`:
```python
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
            select(Event)
            .where(Event.aggregate_id == aggregate_id)
            .order_by(Event.created_at)
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
```

- [ ] **Step 2: Event ORM 모델 추가**

`backend/src/alma/models/models.py` 끝에 추가:

```python
class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(nullable=False)
    source: Mapped[str] = mapped_column(nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    aggregate_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    trace_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        Index("idx_events_type", "event_type", "created_at"),
        Index("idx_events_user", "user_id", "created_at"),
        Index("idx_events_aggregate", "aggregate_id", "created_at"),
    )
```

- [ ] **Step 3: Alembic 마이그레이션**

```bash
cd C:/Users/sha2.kim/alma/backend
source .venv/Scripts/activate && export $(grep -v '^#' .env | xargs)
alembic revision --autogenerate -m "add events table"
alembic upgrade head
```

- [ ] **Step 4: 테스트 파일 생성 (8 tests)**

```python
# backend/tests/test_event_bus.py
import uuid
from datetime import datetime, timedelta
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
        timestamp=datetime.utcnow(),
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
    assert len(success) == 1  # 두 번째 핸들러는 정상 실행


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

    since = datetime.utcnow() - timedelta(minutes=1)
    results = await repo.query_by_type("chat.message", since)
    assert len(results) == 2


@pytest.mark.asyncio
async def test_event_store_query_by_user(db_session: AsyncSession, test_user):
    repo = EventStoreRepository(db_session)
    await repo.append(_make_event(user_id=str(test_user.id)))
    await repo.append(_make_event(user_id=str(uuid.uuid4())))  # 다른 사용자

    since = datetime.utcnow() - timedelta(minutes=1)
    results = await repo.query_by_user(test_user.id, since)
    assert len(results) == 1


@pytest.mark.asyncio
async def test_emit_helper(db_session: AsyncSession, test_user):
    """emit 헬퍼로 이벤트 발행 확인 (버스에 핸들러 등록 후)"""
    from alma.core.events import event_bus
    received = []
    handler = AsyncMock(side_effect=lambda e: received.append(e))
    event_bus.subscribe("test.emit", handler)

    from alma.core.events.helpers import emit
    await emit("test.emit", "test", {"data": 123}, user_id=str(test_user.id))

    assert len(received) == 1
    assert received[0].payload == {"data": 123}
    # cleanup
    event_bus._handlers.pop("test.emit", None)
```

- [ ] **Step 5: 테스트 실행**

```bash
cd C:/Users/sha2.kim/alma/backend && source .venv/Scripts/activate && export $(grep -v '^#' .env | xargs)
pytest tests/test_event_bus.py -v
```
Expected: 8 passed

- [ ] **Step 6: Ruff + 커밋**

```bash
ruff check src/alma/core/ tests/test_event_bus.py && ruff format src/alma/core/ tests/test_event_bus.py
cd C:/Users/sha2.kim/alma
git add backend/src/alma/core/ backend/src/alma/models/models.py backend/alembic/versions/ backend/tests/test_event_bus.py
git commit -m "feat: event infrastructure — DomainEvent, InMemoryEventBus, EventStore (8 tests)"
```

---

## Task 2: 기존 서비스 이벤트 발행 통합

**Files:** Modify 4 service files

- [ ] **Step 1: ChatService에 이벤트 발행**

`backend/src/alma/domain/chat/service.py`의 `process_message` 끝 (return 직전)에 추가:

```python
        # 이벤트 발행 (fire-and-forget)
        try:
            from alma.core.events.helpers import emit
            await emit(
                "chat.message_processed", "chat",
                {"conversation_id": conversation_id, "content_preview": content[:100]},
                user_id=user_id,
            )
        except Exception:
            pass  # 이벤트 실패가 주 로직에 영향 없음
```

- [ ] **Step 2: HabitService에 이벤트 발행**

`checkin` 메서드 끝 (return 직전):
```python
        try:
            from alma.core.events.helpers import emit
            await emit(
                "habit.checkin_completed", "habit",
                {"habit_id": str(habit_id), "completed": completed, "source": source},
                user_id=str(user_id), aggregate_id=str(habit_id),
            )
        except Exception:
            pass
```

`create_habit` 메서드 끝 (return 직전):
```python
        try:
            from alma.core.events.helpers import emit
            await emit(
                "habit.created", "habit",
                {"habit_id": str(habit.id), "title": habit.title, "frequency_type": habit.frequency_type},
                user_id=str(user_id), aggregate_id=str(habit.id),
            )
        except Exception:
            pass
```

`delete_habit` 메서드 끝:
```python
        try:
            from alma.core.events.helpers import emit
            await emit("habit.deleted", "habit", {"habit_id": str(habit_id)})
        except Exception:
            pass
```

- [ ] **Step 3: IntegrationService에 이벤트 발행**

`execute_action` 메서드, `action_log_repo.create` 호출 뒤:
```python
        try:
            from alma.core.events.helpers import emit
            await emit(
                "integration.action_executed", "integration",
                {"service": intent.service, "action": intent.action, "success": success},
                user_id=user_id,
            )
        except Exception:
            pass
```

- [ ] **Step 4: GoalService에 이벤트 발행**

`create_goal` 끝:
```python
        try:
            from alma.core.events.helpers import emit
            await emit(
                "goal.created", "growth",
                {"goal_id": str(goal.id), "title": goal.title},
                user_id=str(user_id), aggregate_id=str(goal.id),
            )
        except Exception:
            pass
```

`update_goal` (status 변경 감지):
```python
        # status 변경 시 이벤트
        if "status" in kwargs:
            try:
                from alma.core.events.helpers import emit
                await emit(
                    "goal.status_changed", "growth",
                    {"goal_id": str(goal.id), "old_status": old_status, "new_status": kwargs["status"]},
                    user_id=str(goal.user_id), aggregate_id=str(goal.id),
                )
            except Exception:
                pass
```

- [ ] **Step 5: main.py에 EventStoreHandler 등록**

```python
from alma.core.events import event_bus
from alma.core.events.store import EventStoreHandler
from alma.database import async_session

# EventStore 글로벌 핸들러 등록
event_store_handler = EventStoreHandler(async_session)
event_bus.subscribe_all(event_store_handler.handle)
```

이 코드를 `app = FastAPI(...)` 뒤, 라우터 등록 전에 추가.

- [ ] **Step 6: 전체 테스트**

```bash
cd C:/Users/sha2.kim/alma/backend && source .venv/Scripts/activate && export $(grep -v '^#' .env | xargs)
ruff check src/ tests/
pytest tests/test_event_bus.py tests/test_habit_service.py tests/test_goal_service.py -v
```

- [ ] **Step 7: 커밋**

```bash
cd C:/Users/sha2.kim/alma
git add backend/src/alma/domain/chat/service.py backend/src/alma/domain/habit/service.py backend/src/alma/domain/integration/service.py backend/src/alma/domain/growth/service.py backend/src/alma/main.py
git commit -m "feat: integrate event publishing across ChatService, HabitService, IntegrationService, GoalService"
```

---

## Task 3: 전체 검증 + push

- [ ] **Step 1: 백엔드 전체 테스트**

```bash
cd C:/Users/sha2.kim/alma/backend && source .venv/Scripts/activate && export $(grep -v '^#' .env | xargs)
pytest tests/ -v
```

- [ ] **Step 2: Ruff**

```bash
ruff check src/ tests/
```

- [ ] **Step 3: 프론트엔드 빌드**

```bash
cd C:/Users/sha2.kim/alma/frontend && npx tsc --noEmit
```

- [ ] **Step 4: push**

```bash
cd C:/Users/sha2.kim/alma && git push origin feature/phase1-mvp
```
