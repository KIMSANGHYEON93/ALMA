# Sub-2 Chunk 1: 이벤트 인프라 (이벤트 버스 + 이벤트 스토어)

## 1. 개요

비전 문서(섹션 4)의 이벤트 버스 + 이벤트 스토어를 구현한다. 모든 도메인 이벤트의 발행/구독/영속화 인프라.

**범위:**
- DomainEvent 값 객체
- EventBus (인메모리 Pub/Sub, 비동기)
- EventStore (PostgreSQL events 테이블, JSONB)
- 기존 서비스에 이벤트 발행 통합 (ChatService, HabitService, IntegrationService)
- 멱등성 키 + At-Least-Once 전달

**범위 외:** Redis Pub/Sub 전환, 분산 트랜잭션, Outbox 패턴 (향후), 멀티 LLM 라우터, 멀티 채널

---

## 2. 도메인 모델

### 2.1 DomainEvent

```python
@dataclass(frozen=True)
class DomainEvent:
    id: str                        # UUID
    event_type: str                # "chat.message_received", "habit.checkin_completed"
    source: str                    # "chat", "habit", "integration"
    payload: dict                  # 이벤트 데이터 (JSONB)
    timestamp: datetime
    aggregate_id: str | None = None
    user_id: str | None = None
    trace_id: str | None = None
```

### 2.2 이벤트 타입 카탈로그 (초기)

| 이벤트 타입 | 소스 | 발행 시점 | payload 예시 |
|------------|------|----------|-------------|
| `chat.message_processed` | chat | 메시지 처리 완료 후 | `{conversation_id, content_preview}` |
| `habit.checkin_completed` | habit | 체크인 성공 | `{habit_id, habit_title, completed, source}` |
| `habit.created` | habit | 습관 생성 | `{habit_id, title, frequency_type}` |
| `habit.deleted` | habit | 습관 삭제 | `{habit_id, title}` |
| `integration.action_executed` | integration | 액션 실행 완료 | `{service, action, success}` |
| `goal.created` | growth | 목표 생성 | `{goal_id, title}` |
| `goal.status_changed` | growth | 목표 상태 변경 | `{goal_id, old_status, new_status}` |

### 2.3 네이밍 규칙

`{bounded_context}.{event_name}` — 소문자, snake_case

---

## 3. EventBus — 인메모리 구현

### 3.1 인터페이스

```python
class EventBus(Protocol):
    async def publish(self, event: DomainEvent) -> None: ...
    def subscribe(self, event_type: str, handler: Callable) -> None: ...
    def subscribe_all(self, handler: Callable) -> None: ...
```

### 3.2 InMemoryEventBus

```python
class InMemoryEventBus:
    def __init__(self):
        self._handlers: dict[str, list[Callable]] = {}
        self._global_handlers: list[Callable] = []

    async def publish(self, event: DomainEvent) -> None:
        # 타입별 핸들러
        for handler in self._handlers.get(event.event_type, []):
            try:
                await handler(event)
            except Exception:
                logger.warning(f"Handler failed for {event.event_type}", exc_info=True)
        # 글로벌 핸들러 (이벤트 스토어 등)
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

### 3.3 싱글톤 인스턴스

`core/events/__init__.py`에서 글로벌 event_bus 인스턴스 노출:

```python
event_bus = InMemoryEventBus()
```

앱 시작 시 (`main.py`) EventStore를 글로벌 핸들러로 등록:

```python
from alma.core.events import event_bus
from alma.core.events.store import EventStoreHandler

# EventStore 글로벌 핸들러 등록
event_store_handler = EventStoreHandler(async_session)
event_bus.subscribe_all(event_store_handler.handle)
```

---

## 4. EventStore — PostgreSQL 영속화

### 4.1 events 테이블

```sql
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(255) NOT NULL,
    source VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    aggregate_id UUID,
    user_id UUID,
    trace_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_events_type ON events (event_type, created_at);
CREATE INDEX idx_events_user ON events (user_id, created_at);
CREATE INDEX idx_events_aggregate ON events (aggregate_id, created_at);
```

### 4.2 EventStore ORM 모델

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

### 4.3 EventStoreRepository

```python
class EventStoreRepository:
    async def append(self, event: DomainEvent) -> None: ...
    async def query_by_type(self, event_type: str, since: datetime, limit: int = 100) -> list[Event]: ...
    async def query_by_user(self, user_id: uuid.UUID, since: datetime, limit: int = 100) -> list[Event]: ...
    async def query_by_aggregate(self, aggregate_id: uuid.UUID) -> list[Event]: ...
```

### 4.4 EventStoreHandler

글로벌 핸들러로 등록되어 모든 이벤트를 DB에 저장:

```python
class EventStoreHandler:
    def __init__(self, session_factory):
        self.session_factory = session_factory

    async def handle(self, event: DomainEvent) -> None:
        async with self.session_factory() as session:
            repo = EventStoreRepository(session)
            await repo.append(event)
```

---

## 5. 기존 서비스 이벤트 발행 통합

### 5.1 통합 방식

각 서비스에서 이벤트 발행은 **파이어 앤 포겟** (비동기, 실패해도 주 로직에 영향 없음):

```python
from alma.core.events import event_bus
from alma.core.events.models import DomainEvent

# ChatService.process_message 끝에
await event_bus.publish(DomainEvent(
    id=str(uuid.uuid4()),
    event_type="chat.message_processed",
    source="chat",
    payload={"conversation_id": conversation_id, "content_preview": content[:100]},
    timestamp=datetime.utcnow(),
    user_id=user_id,
))
```

### 5.2 이벤트 발행 위치

| 서비스 | 메서드 | 이벤트 |
|--------|--------|--------|
| ChatService | process_message | `chat.message_processed` |
| HabitService | checkin | `habit.checkin_completed` |
| HabitService | create_habit | `habit.created` |
| HabitService | delete_habit | `habit.deleted` |
| IntegrationService | execute_action | `integration.action_executed` |
| GoalService | create_goal | `goal.created` |
| GoalService | update_goal (status 변경 시) | `goal.status_changed` |

### 5.3 이벤트 발행 헬퍼

반복 코드를 줄이기 위한 유틸:

```python
# core/events/helpers.py
async def emit(event_type: str, source: str, payload: dict,
               user_id: str | None = None, aggregate_id: str | None = None) -> None:
    await event_bus.publish(DomainEvent(
        id=str(uuid.uuid4()),
        event_type=event_type,
        source=source,
        payload=payload,
        timestamp=datetime.utcnow(),
        user_id=user_id,
        aggregate_id=aggregate_id,
    ))
```

---

## 6. 파일 구조

### Create
| 파일 | 책임 |
|------|------|
| `backend/src/alma/core/__init__.py` | 코어 패키지 |
| `backend/src/alma/core/events/__init__.py` | event_bus 싱글톤 노출 |
| `backend/src/alma/core/events/models.py` | DomainEvent 데이터클래스 |
| `backend/src/alma/core/events/bus.py` | InMemoryEventBus |
| `backend/src/alma/core/events/store.py` | EventStoreRepository + EventStoreHandler |
| `backend/src/alma/core/events/helpers.py` | emit() 헬퍼 |
| `backend/tests/test_event_bus.py` | 이벤트 버스 + 스토어 테스트 |

### Modify
| 파일 | 변경 |
|------|------|
| `backend/src/alma/models/models.py` | +Event ORM 모델 |
| `backend/src/alma/main.py` | +EventStoreHandler 등록 |
| `backend/src/alma/domain/chat/service.py` | +chat.message_processed 이벤트 |
| `backend/src/alma/domain/habit/service.py` | +habit.* 이벤트 |
| `backend/src/alma/domain/integration/service.py` | +integration.action_executed 이벤트 |
| `backend/src/alma/domain/growth/service.py` | +goal.* 이벤트 |
| Alembic migration | +events 테이블 |

---

## 7. 테스트

| # | 테스트 | 내용 |
|---|--------|------|
| 1 | test_publish_subscribe | 이벤트 발행 → 핸들러 호출 확인 |
| 2 | test_subscribe_specific_type | 특정 타입만 구독 → 다른 타입 무시 |
| 3 | test_subscribe_all | 글로벌 핸들러가 모든 이벤트 수신 |
| 4 | test_handler_error_isolated | 핸들러 에러가 다른 핸들러에 영향 없음 |
| 5 | test_event_store_append | 이벤트 DB 저장 확인 |
| 6 | test_event_store_query_by_type | 타입별 조회 |
| 7 | test_event_store_query_by_user | 사용자별 조회 |
| 8 | test_emit_helper | emit() 헬퍼로 이벤트 발행 + 저장 |

---

## 8. Chunk 2/3 예고

- Chunk 2: Automation Engine — 이벤트 스트림에서 패턴 감지 + 규칙 CRUD
- Chunk 3: 규칙 실행 엔진 + UI 대시보드
