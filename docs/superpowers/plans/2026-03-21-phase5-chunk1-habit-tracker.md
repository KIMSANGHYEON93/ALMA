# Phase 5 Chunk 1: Habit Tracker Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 습관 CRUD + 체크인(upsert) + 유연한 streak 계산 + 프론트엔드 UI가 동작하는 습관 트래커 MVP

**Architecture:** DDD habit 바운디드 컨텍스트 (`domain/habit/`). 기존 growth 컨텍스트 패턴(Repository → Service → API Router) 동일. ORM은 Shared Kernel (`models/models.py`), Enum은 도메인 모델 (`domain/habit/models.py`).

**Tech Stack:** Python 3.14, FastAPI, SQLAlchemy 2.0 async, Alembic, pytest-asyncio, Next.js 14, React 18, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-21-phase5-chunk1-habit-tracker.md`

---

## File Structure

### Backend — Create
| File | Responsibility |
|------|---------------|
| `backend/src/alma/domain/habit/__init__.py` | 패키지 초기화 |
| `backend/src/alma/domain/habit/models.py` | FrequencyType, HabitStatus, CheckinSource Enum |
| `backend/src/alma/domain/habit/repository.py` | HabitRepository, HabitLogRepository |
| `backend/src/alma/domain/habit/service.py` | HabitService (CRUD, checkin, streak, schedule) |
| `backend/src/alma/api/habits.py` | FastAPI 라우터 + Pydantic 스키마 |
| `backend/tests/test_habit_service.py` | 15개 테스트 |

### Backend — Modify
| File | Change |
|------|--------|
| `backend/src/alma/models/models.py` | +Habit, +HabitLog ORM 클래스 |
| `backend/src/alma/main.py` | +habits_router include |

### Frontend — Create
| File | Responsibility |
|------|---------------|
| `frontend/src/app/habits/page.tsx` | /habits 메인 페이지 |
| `frontend/src/components/HabitCard.tsx` | 습관 카드 (체크인 + streak) |
| `frontend/src/components/HabitForm.tsx` | 생성/수정 모달 |
| `frontend/src/components/HabitTodaySummary.tsx` | 오늘 요약 바 |
| `frontend/src/hooks/useHabits.ts` | 습관 API 훅 |

### Frontend — Modify
| File | Change |
|------|--------|
| `frontend/src/lib/types.ts` | +Habit, HabitLog, TodaySummary 타입 |
| `frontend/src/components/common/NavBar.tsx` | +습관 탭 |
| `frontend/src/middleware.ts` | +/habits 보호 경로 |

---

## Task 1: ORM 모델 + 도메인 Enum + 마이그레이션

**Files:**
- Create: `backend/src/alma/domain/habit/__init__.py`
- Create: `backend/src/alma/domain/habit/models.py`
- Modify: `backend/src/alma/models/models.py`
- Alembic migration (autogenerate)

- [ ] **Step 1: 도메인 Enum 파일 생성**

```python
# backend/src/alma/domain/habit/__init__.py
# (empty)
```

```python
# backend/src/alma/domain/habit/models.py
from enum import Enum


class FrequencyType(str, Enum):
    DAILY = "daily"
    SPECIFIC_DAYS = "specific_days"
    TIMES_PER_WEEK = "times_per_week"
    EVERY_N_DAYS = "every_n_days"


class HabitStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


class CheckinSource(str, Enum):
    UI = "ui"
    CHAT = "chat"
```

- [ ] **Step 2: ORM 모델을 models/models.py에 추가**

파일 끝(Insight 클래스 아래)에 추가:

```python
class Habit(Base):
    __tablename__ = "habits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    goal_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("goals.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    frequency_type: Mapped[str] = mapped_column(nullable=False)
    frequency_value: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    target_value: Mapped[float | None] = mapped_column(nullable=True)
    target_unit: Mapped[str | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(nullable=False, default="active")
    start_date = mapped_column(Date, nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    logs: Mapped[list["HabitLog"]] = relationship(
        back_populates="habit", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_habits_user", "user_id", "status"),
        CheckConstraint(
            "frequency_type IN ('daily','specific_days','times_per_week','every_n_days')",
            name="ck_habits_frequency_type",
        ),
        CheckConstraint(
            "status IN ('active','paused','archived')",
            name="ck_habits_status",
        ),
    )


class HabitLog(Base):
    __tablename__ = "habit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    habit_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("habits.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    log_date = mapped_column(Date, nullable=False)
    completed: Mapped[bool] = mapped_column(nullable=False)
    value: Mapped[float | None] = mapped_column(nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(nullable=False, default="ui")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    habit: Mapped["Habit"] = relationship(back_populates="logs")

    __table_args__ = (
        UniqueConstraint("habit_id", "log_date", name="uq_habit_log_date"),
        Index("idx_habit_logs_habit_date", "habit_id", "log_date"),
        Index("idx_habit_logs_user_date", "user_id", "log_date"),
        CheckConstraint(
            "source IN ('ui','chat')",
            name="ck_habit_logs_source",
        ),
    )
```

- [ ] **Step 3: Alembic 마이그레이션 생성**

```bash
cd backend
DATABASE_URL="$DATABASE_URL" alembic revision --autogenerate -m "add habits and habit_logs tables"
```

마이그레이션 파일을 열어 확인. `import pgvector.sqlalchemy.vector` 는 이번엔 불필요 (vector 컬럼 없음).

- [ ] **Step 4: 마이그레이션 적용 및 확인**

```bash
DATABASE_URL="$DATABASE_URL" alembic upgrade head
```

- [ ] **Step 5: 커밋**

```bash
git add backend/src/alma/domain/habit/ backend/src/alma/models/models.py backend/alembic/versions/
git commit -m "feat: add Habit + HabitLog ORM models and migration"
```

---

## Task 2: HabitRepository + HabitLogRepository

**Files:**
- Create: `backend/src/alma/domain/habit/repository.py`
- Test: `backend/tests/test_habit_service.py` (repo 관련 테스트)

- [ ] **Step 1: 테스트 파일 생성 — repo 기본 테스트**

```python
# backend/tests/test_habit_service.py
import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.habit.models import FrequencyType, HabitStatus
from alma.domain.habit.repository import HabitLogRepository, HabitRepository
from alma.models.models import Habit


@pytest.mark.asyncio
async def test_create_habit(db_session: AsyncSession, test_user):
    repo = HabitRepository(db_session)
    habit = await repo.create(
        user_id=test_user.id,
        title="물 마시기",
        frequency_type="daily",
        frequency_value={},
        start_date=date.today(),
    )
    assert habit.id is not None
    assert habit.title == "물 마시기"
    assert habit.status == "active"
    assert habit.start_date == date.today()


@pytest.mark.asyncio
async def test_create_habit_with_goal(db_session: AsyncSession, test_user):
    from alma.domain.growth.service import GoalService

    goal_service = GoalService(db_session)
    goal = await goal_service.create_goal(test_user.id, "건강")
    repo = HabitRepository(db_session)
    habit = await repo.create(
        user_id=test_user.id,
        title="운동",
        frequency_type="specific_days",
        frequency_value={"days": [0, 2, 4]},
        start_date=date.today(),
        goal_id=goal.id,
    )
    assert habit.goal_id == goal.id


@pytest.mark.asyncio
async def test_list_habits_by_status(db_session: AsyncSession, test_user):
    repo = HabitRepository(db_session)
    await repo.create(
        user_id=test_user.id, title="Active", frequency_type="daily",
        frequency_value={}, start_date=date.today(),
    )
    h2 = await repo.create(
        user_id=test_user.id, title="Paused", frequency_type="daily",
        frequency_value={}, start_date=date.today(),
    )
    h2.status = "paused"
    await repo.update(h2)

    active = await repo.list_by_user(test_user.id, status="active")
    assert len(active) == 1
    assert active[0].title == "Active"

    all_habits = await repo.list_by_user(test_user.id)
    assert len(all_habits) == 2


@pytest.mark.asyncio
async def test_delete_habit_cascades_logs(db_session: AsyncSession, test_user):
    repo = HabitRepository(db_session)
    log_repo = HabitLogRepository(db_session)
    habit = await repo.create(
        user_id=test_user.id, title="삭제 테스트", frequency_type="daily",
        frequency_value={}, start_date=date.today(),
    )
    await log_repo.upsert(
        habit_id=habit.id, user_id=test_user.id,
        log_date=date.today(), completed=True, source="ui",
    )
    await repo.delete(habit.id)
    logs = await log_repo.list_by_habit(habit.id, date.today() - timedelta(days=1), date.today())
    assert len(logs) == 0
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd backend && pytest tests/test_habit_service.py -v
```
Expected: FAIL (repository 모듈 없음)

- [ ] **Step 3: HabitRepository 구현**

```python
# backend/src/alma/domain/habit/repository.py
import uuid
from datetime import date

from sqlalchemy import desc, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from alma.models.models import Habit, HabitLog


class HabitRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        title: str,
        frequency_type: str,
        frequency_value: dict,
        start_date: date,
        description: str | None = None,
        target_value: float | None = None,
        target_unit: str | None = None,
        goal_id: uuid.UUID | None = None,
        sort_order: int = 0,
    ) -> Habit:
        habit = Habit(
            user_id=user_id,
            title=title,
            frequency_type=frequency_type,
            frequency_value=frequency_value,
            start_date=start_date,
            description=description,
            target_value=target_value,
            target_unit=target_unit,
            goal_id=goal_id,
            sort_order=sort_order,
        )
        self.session.add(habit)
        await self.session.commit()
        await self.session.refresh(habit)
        return habit

    async def get(self, habit_id: uuid.UUID) -> Habit | None:
        result = await self.session.execute(select(Habit).where(Habit.id == habit_id))
        return result.scalar_one_or_none()

    async def list_by_user(
        self, user_id: uuid.UUID, status: str | None = None
    ) -> list[Habit]:
        query = select(Habit).where(Habit.user_id == user_id)
        if status:
            query = query.where(Habit.status == status)
        query = query.order_by(Habit.sort_order, desc(Habit.updated_at))
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def update(self, habit: Habit) -> Habit:
        await self.session.commit()
        await self.session.refresh(habit)
        return habit

    async def delete(self, habit_id: uuid.UUID) -> None:
        habit = await self.get(habit_id)
        if habit:
            await self.session.delete(habit)
            await self.session.commit()


class HabitLogRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def upsert(
        self,
        habit_id: uuid.UUID,
        user_id: uuid.UUID,
        log_date: date,
        completed: bool,
        source: str = "ui",
        value: float | None = None,
        note: str | None = None,
    ) -> HabitLog:
        existing = await self.get_by_date(habit_id, log_date)
        if existing:
            existing.completed = completed
            existing.value = value
            existing.note = note
            existing.source = source
            await self.session.commit()
            await self.session.refresh(existing)
            return existing
        log = HabitLog(
            habit_id=habit_id,
            user_id=user_id,
            log_date=log_date,
            completed=completed,
            value=value,
            note=note,
            source=source,
        )
        self.session.add(log)
        await self.session.commit()
        await self.session.refresh(log)
        return log

    async def get_by_date(self, habit_id: uuid.UUID, log_date: date) -> HabitLog | None:
        result = await self.session.execute(
            select(HabitLog).where(
                HabitLog.habit_id == habit_id, HabitLog.log_date == log_date
            )
        )
        return result.scalar_one_or_none()

    async def list_by_habit(
        self, habit_id: uuid.UUID, start: date, end: date
    ) -> list[HabitLog]:
        result = await self.session.execute(
            select(HabitLog)
            .where(
                HabitLog.habit_id == habit_id,
                HabitLog.log_date >= start,
                HabitLog.log_date <= end,
            )
            .order_by(desc(HabitLog.log_date))
        )
        return list(result.scalars().all())

    async def list_by_user_date(
        self, user_id: uuid.UUID, log_date: date
    ) -> list[HabitLog]:
        result = await self.session.execute(
            select(HabitLog).where(
                HabitLog.user_id == user_id, HabitLog.log_date == log_date
            )
        )
        return list(result.scalars().all())

    async def get_completed_dates(
        self, habit_id: uuid.UUID, start: date, end: date
    ) -> set[date]:
        result = await self.session.execute(
            select(HabitLog.log_date).where(
                HabitLog.habit_id == habit_id,
                HabitLog.completed.is_(True),
                HabitLog.log_date >= start,
                HabitLog.log_date <= end,
            )
        )
        return {row[0] for row in result.all()}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd backend && pytest tests/test_habit_service.py -v
```
Expected: 4 passed

- [ ] **Step 5: 커밋**

```bash
git add backend/src/alma/domain/habit/repository.py backend/tests/test_habit_service.py
git commit -m "feat: HabitRepository + HabitLogRepository with 4 tests"
```

---

## Task 3: HabitService — is_scheduled + streak + checkin + today_summary

**Files:**
- Create: `backend/src/alma/domain/habit/service.py`
- Modify: `backend/tests/test_habit_service.py` (+11 테스트)

- [ ] **Step 1: 서비스 테스트 추가**

`test_habit_service.py` 끝에 다음 테스트를 추가:

```python
from alma.domain.habit.service import HabitService


@pytest.mark.asyncio
async def test_checkin_boolean(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    habit = await service.create_habit(
        test_user.id, "독서", frequency_type="daily",
        frequency_value={}, start_date=date.today(),
    )
    log = await service.checkin(habit.id, test_user.id, date.today(), completed=True, source="ui")
    assert log.completed is True
    assert log.source == "ui"


@pytest.mark.asyncio
async def test_checkin_with_value(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    habit = await service.create_habit(
        test_user.id, "물", frequency_type="daily",
        frequency_value={}, start_date=date.today(),
        target_value=8, target_unit="잔",
    )
    log = await service.checkin(
        habit.id, test_user.id, date.today(),
        completed=True, value=6, note="오늘은 6잔만", source="ui",
    )
    assert log.value == 6
    assert log.note == "오늘은 6잔만"


@pytest.mark.asyncio
async def test_checkin_upsert(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    habit = await service.create_habit(
        test_user.id, "운동", frequency_type="daily",
        frequency_value={}, start_date=date.today(),
    )
    log1 = await service.checkin(habit.id, test_user.id, date.today(), completed=False, source="ui")
    log2 = await service.checkin(habit.id, test_user.id, date.today(), completed=True, source="chat")
    assert log1.id == log2.id
    assert log2.completed is True
    assert log2.source == "chat"


@pytest.mark.asyncio
async def test_checkin_owner_validation(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    habit = await service.create_habit(
        test_user.id, "독서", frequency_type="daily",
        frequency_value={}, start_date=date.today(),
    )
    other_user_id = uuid.uuid4()
    with pytest.raises(PermissionError):
        await service.checkin(habit.id, other_user_id, date.today(), completed=True, source="ui")


@pytest.mark.asyncio
async def test_is_scheduled_today(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    today = date.today()

    # daily — always scheduled
    h_daily = await service.create_habit(
        test_user.id, "daily", frequency_type="daily",
        frequency_value={}, start_date=today,
    )
    assert HabitService.is_scheduled(h_daily, today) is True

    # specific_days — only on matching weekdays
    h_days = await service.create_habit(
        test_user.id, "days", frequency_type="specific_days",
        frequency_value={"days": [today.weekday()]}, start_date=today,
    )
    assert HabitService.is_scheduled(h_days, today) is True
    tomorrow = today + timedelta(days=1)
    if tomorrow.weekday() != today.weekday():
        assert HabitService.is_scheduled(h_days, tomorrow) is False

    # times_per_week — always True
    h_times = await service.create_habit(
        test_user.id, "times", frequency_type="times_per_week",
        frequency_value={"times": 3}, start_date=today,
    )
    assert HabitService.is_scheduled(h_times, today) is True

    # every_n_days — interval based on start_date
    h_every = await service.create_habit(
        test_user.id, "every", frequency_type="every_n_days",
        frequency_value={"interval": 2}, start_date=today,
    )
    assert HabitService.is_scheduled(h_every, today) is True
    assert HabitService.is_scheduled(h_every, today + timedelta(days=1)) is False
    assert HabitService.is_scheduled(h_every, today + timedelta(days=2)) is True


@pytest.mark.asyncio
async def test_streak_daily(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    today = date.today()
    habit = await service.create_habit(
        test_user.id, "매일", frequency_type="daily",
        frequency_value={}, start_date=today - timedelta(days=10),
    )
    # 3일 연속 체크인 (오늘, 어제, 그제)
    for i in range(3):
        await service.checkin(habit.id, test_user.id, today - timedelta(days=i), completed=True, source="ui")
    streak = await service.get_streak(habit, today)
    assert streak == 3


@pytest.mark.asyncio
async def test_streak_specific_days(db_session: AsyncSession, test_user):
    """월수금 습관: 화목은 스킵, 월수만 체크인 → streak = 2"""
    service = HabitService(db_session)
    # 월요일 찾기
    today = date.today()
    days_since_monday = today.weekday()
    monday = today - timedelta(days=days_since_monday)

    habit = await service.create_habit(
        test_user.id, "월수금", frequency_type="specific_days",
        frequency_value={"days": [0, 2, 4]},  # 월, 수, 금
        start_date=monday - timedelta(days=7),
    )
    # 이번 주 월, 수 체크인
    await service.checkin(habit.id, test_user.id, monday, completed=True, source="ui")
    wed = monday + timedelta(days=2)
    await service.checkin(habit.id, test_user.id, wed, completed=True, source="ui")

    streak = await service.get_streak(habit, wed)
    assert streak == 2  # 수, 월 연속 (화는 쉬는 날이라 스킵)


@pytest.mark.asyncio
async def test_streak_times_per_week(db_session: AsyncSession, test_user):
    """주 3회 습관: 고정 날짜로 2주 연속 달성 → streak = 2주"""
    service = HabitService(db_session)
    # 고정 날짜 사용 (테스트 안정성)
    # 2026-03-09 = 월요일
    this_monday = date(2026, 3, 16)
    last_monday = date(2026, 3, 9)
    as_of = date(2026, 3, 18)  # 수요일 — 이번 주 이미 3회 달성

    habit = await service.create_habit(
        test_user.id, "주3", frequency_type="times_per_week",
        frequency_value={"times": 3},
        start_date=date(2026, 3, 2),
    )
    # 지난 주 3회 (월, 화, 수)
    for i in range(3):
        await service.checkin(
            habit.id, test_user.id, last_monday + timedelta(days=i),
            completed=True, source="ui",
        )
    # 이번 주 3회 (월, 화, 수)
    for i in range(3):
        await service.checkin(
            habit.id, test_user.id, this_monday + timedelta(days=i),
            completed=True, source="ui",
        )

    streak = await service.get_streak(habit, as_of)
    assert streak == 2


@pytest.mark.asyncio
async def test_streak_every_n_days(db_session: AsyncSession, test_user):
    """격일 습관: 0일, 2일, 4일 체크인 → streak = 3"""
    service = HabitService(db_session)
    today = date.today()
    start = today - timedelta(days=10)

    habit = await service.create_habit(
        test_user.id, "격일", frequency_type="every_n_days",
        frequency_value={"interval": 2},
        start_date=start,
    )
    # start로부터 0, 2, 4일째 체크인 (최근 3개 예정일)
    for offset in [4, 6, 8]:
        d = start + timedelta(days=offset)
        await service.checkin(habit.id, test_user.id, d, completed=True, source="ui")

    as_of = start + timedelta(days=8)
    streak = await service.get_streak(habit, as_of)
    assert streak == 3


@pytest.mark.asyncio
async def test_streak_broken(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    today = date.today()
    habit = await service.create_habit(
        test_user.id, "매일", frequency_type="daily",
        frequency_value={}, start_date=today - timedelta(days=10),
    )
    # 오늘, 어제 체크인, 그제 누락
    await service.checkin(habit.id, test_user.id, today, completed=True, source="ui")
    await service.checkin(habit.id, test_user.id, today - timedelta(days=1), completed=True, source="ui")
    # today-2 는 누락
    streak = await service.get_streak(habit, today)
    assert streak == 2


@pytest.mark.asyncio
async def test_today_summary(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    today = date.today()

    # daily 습관 2개
    h1 = await service.create_habit(
        test_user.id, "물", frequency_type="daily",
        frequency_value={}, start_date=today,
    )
    h2 = await service.create_habit(
        test_user.id, "운동", frequency_type="daily",
        frequency_value={}, start_date=today,
    )
    # h1만 체크인
    await service.checkin(h1.id, test_user.id, today, completed=True, source="ui")

    summary = await service.get_today_summary(test_user.id)
    assert summary["date"] == today.isoformat()
    assert summary["total"] == 2
    assert summary["completed"] == 1
    assert len(summary["habits"]) == 2
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd backend && pytest tests/test_habit_service.py -v
```
Expected: 새 테스트들 FAIL (HabitService 없음)

- [ ] **Step 3: HabitService 구현**

```python
# backend/src/alma/domain/habit/service.py
import uuid
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.habit.repository import HabitLogRepository, HabitRepository
from alma.models.models import Habit, HabitLog


class HabitService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.habit_repo = HabitRepository(session)
        self.log_repo = HabitLogRepository(session)

    async def create_habit(
        self,
        user_id: uuid.UUID,
        title: str,
        frequency_type: str = "daily",
        frequency_value: dict | None = None,
        start_date: date | None = None,
        **kwargs,
    ) -> Habit:
        return await self.habit_repo.create(
            user_id=user_id,
            title=title,
            frequency_type=frequency_type,
            frequency_value=frequency_value or {},
            start_date=start_date or date.today(),
            **kwargs,
        )

    async def get_habit(self, habit_id: uuid.UUID, user_id: uuid.UUID) -> Habit | None:
        habit = await self.habit_repo.get(habit_id)
        if habit and habit.user_id == user_id:
            return habit
        return None

    async def list_habits(
        self, user_id: uuid.UUID, status: str | None = None
    ) -> list[Habit]:
        return await self.habit_repo.list_by_user(user_id, status)

    async def update_habit(self, habit: Habit, **kwargs) -> Habit:
        old_status = habit.status
        for key, value in kwargs.items():
            if hasattr(habit, key):
                setattr(habit, key, value)
        # paused → active: reset start_date
        new_status = kwargs.get("status")
        if old_status == "paused" and new_status == "active":
            habit.start_date = date.today()
        return await self.habit_repo.update(habit)

    async def delete_habit(self, habit_id: uuid.UUID) -> None:
        await self.habit_repo.delete(habit_id)

    async def checkin(
        self,
        habit_id: uuid.UUID,
        user_id: uuid.UUID,
        log_date: date,
        completed: bool,
        source: str = "ui",
        value: float | None = None,
        note: str | None = None,
    ) -> HabitLog:
        habit = await self.habit_repo.get(habit_id)
        if not habit or habit.user_id != user_id:
            raise PermissionError("Not the owner of this habit")
        return await self.log_repo.upsert(
            habit_id=habit_id,
            user_id=user_id,
            log_date=log_date,
            completed=completed,
            source=source,
            value=value,
            note=note,
        )

    async def get_logs(
        self,
        habit_id: uuid.UUID,
        start: date | None = None,
        end: date | None = None,
    ) -> list[HabitLog]:
        end = end or date.today()
        start = start or (end - timedelta(days=30))
        return await self.log_repo.list_by_habit(habit_id, start, end)

    @staticmethod
    def is_scheduled(habit: Habit, check_date: date) -> bool:
        ft = habit.frequency_type
        fv = habit.frequency_value or {}

        if ft == "daily":
            return True
        elif ft == "specific_days":
            return check_date.weekday() in fv.get("days", [])
        elif ft == "times_per_week":
            return True  # weekly count, always "schedulable"
        elif ft == "every_n_days":
            interval = fv.get("interval", 1)
            delta = (check_date - habit.start_date).days
            return delta >= 0 and delta % interval == 0
        return False

    async def get_streak(self, habit: Habit, as_of: date) -> int:
        if habit.frequency_type == "times_per_week":
            return await self._streak_times_per_week(habit, as_of)
        return await self._streak_day_based(habit, as_of)

    async def _streak_day_based(self, habit: Habit, as_of: date) -> int:
        # Fetch completed dates for last 180 days
        earliest = max(as_of - timedelta(days=180), habit.start_date)
        completed_dates = await self.log_repo.get_completed_dates(habit.id, earliest, as_of)

        streak = 0
        current = as_of
        while current >= earliest:
            if self.is_scheduled(habit, current):
                if current in completed_dates:
                    streak += 1
                else:
                    break
            # Not scheduled = skip (streak preserved)
            current -= timedelta(days=1)
        return streak

    async def _streak_times_per_week(self, habit: Habit, as_of: date) -> int:
        times_needed = (habit.frequency_value or {}).get("times", 1)
        # ISO week: Monday = start
        # Current week: only count if already achieved
        streak = 0

        # Start from current week's Monday
        current_monday = as_of - timedelta(days=as_of.weekday())
        check_monday = current_monday

        # Check current week first (only if already met target)
        start_180 = as_of - timedelta(days=180)
        completed_dates = await self.log_repo.get_completed_dates(
            habit.id, start_180, as_of
        )

        # Current week: count only if target already met
        current_week_count = sum(
            1 for d in completed_dates
            if current_monday <= d <= as_of
        )
        if current_week_count >= times_needed:
            streak += 1
            check_monday = current_monday - timedelta(days=7)
        else:
            # Current week not yet met, start from previous week
            check_monday = current_monday - timedelta(days=7)

        # Check previous weeks
        while check_monday >= start_180:
            week_end = check_monday + timedelta(days=6)
            week_count = sum(
                1 for d in completed_dates
                if check_monday <= d <= week_end
            )
            if week_count >= times_needed:
                streak += 1
                check_monday -= timedelta(days=7)
            else:
                break
        return streak

    async def get_today_summary(self, user_id: uuid.UUID) -> dict:
        today = date.today()
        habits = await self.habit_repo.list_by_user(user_id, status="active")
        today_logs = await self.log_repo.list_by_user_date(user_id, today)
        log_map = {log.habit_id: log for log in today_logs}

        habit_items = []
        completed_count = 0
        scheduled_count = 0

        for habit in habits:
            scheduled = self.is_scheduled(habit, today)
            log = log_map.get(habit.id)
            checked_in = log is not None
            is_completed = log.completed if log else False

            if scheduled:
                scheduled_count += 1
                if is_completed:
                    completed_count += 1

            streak = await self.get_streak(habit, today)

            habit_items.append({
                "id": str(habit.id),
                "title": habit.title,
                "frequency_type": habit.frequency_type,
                "scheduled_today": scheduled,
                "checked_in": checked_in,
                "completed": is_completed,
                "value": log.value if log else None,
                "target_value": habit.target_value,
                "target_unit": habit.target_unit,
                "streak": streak,
                "note": log.note if log else None,
            })

        return {
            "date": today.isoformat(),
            "total": scheduled_count,
            "completed": completed_count,
            "habits": habit_items,
        }
```

- [ ] **Step 4: 전체 테스트 실행 — 통과 확인**

```bash
cd backend && pytest tests/test_habit_service.py -v
```
Expected: 15 passed

- [ ] **Step 5: Ruff lint/format**

```bash
cd backend && ruff check src/alma/domain/habit/ tests/test_habit_service.py && ruff format src/alma/domain/habit/ tests/test_habit_service.py
```

- [ ] **Step 6: 커밋**

```bash
git add backend/src/alma/domain/habit/service.py backend/tests/test_habit_service.py
git commit -m "feat: HabitService with streak calculation (15 tests passing)"
```

---

## Task 4: API 라우터 + main.py 등록

**Files:**
- Create: `backend/src/alma/api/habits.py`
- Modify: `backend/src/alma/main.py`

- [ ] **Step 1: API 라우터 구현**

```python
# backend/src/alma/api/habits.py
import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.dependencies import get_current_user
from alma.database import get_session
from alma.domain.habit.service import HabitService
from alma.models.models import User

router = APIRouter(prefix="/api/habits", tags=["habits"])


# --- Schemas ---


class HabitCreate(BaseModel):
    title: str = Field(min_length=1)
    description: str | None = None
    frequency_type: Literal["daily", "specific_days", "times_per_week", "every_n_days"] = "daily"
    frequency_value: dict = Field(default_factory=dict)
    target_value: float | None = None
    target_unit: str | None = None
    goal_id: str | None = None
    start_date: str | None = None  # ISO format, default today

    @model_validator(mode="after")
    def validate_frequency(self):
        ft = self.frequency_type
        fv = self.frequency_value
        if ft == "daily" and fv and fv != {}:
            raise ValueError("daily frequency_value must be {}")
        if ft == "specific_days":
            days = fv.get("days")
            if not days or not isinstance(days, list):
                raise ValueError("specific_days requires frequency_value.days (list)")
            if any(d not in range(7) for d in days):
                raise ValueError("days must be 0-6")
            if len(days) != len(set(days)):
                raise ValueError("days must not have duplicates")
        if ft == "times_per_week":
            times = fv.get("times")
            if not times or not isinstance(times, int) or times < 1 or times > 7:
                raise ValueError("times_per_week requires frequency_value.times (1-7)")
        if ft == "every_n_days":
            interval = fv.get("interval")
            if not interval or not isinstance(interval, int) or interval < 1:
                raise ValueError("every_n_days requires frequency_value.interval (>= 1)")
        return self


class HabitUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1)
    description: str | None = None
    status: Literal["active", "paused", "archived"] | None = None
    target_value: float | None = None
    target_unit: str | None = None
    sort_order: int | None = None


class CheckinRequest(BaseModel):
    log_date: str  # ISO format
    completed: bool
    value: float | None = None
    note: str | None = None
    source: Literal["ui", "chat"] = "ui"


class HabitResponse(BaseModel):
    id: str
    title: str
    description: str | None
    frequency_type: str
    frequency_value: dict
    target_value: float | None
    target_unit: str | None
    status: str
    goal_id: str | None
    start_date: str
    sort_order: int
    created_at: str
    updated_at: str


class HabitDetailResponse(HabitResponse):
    streak: int


class HabitLogResponse(BaseModel):
    id: str
    habit_id: str
    log_date: str
    completed: bool
    value: float | None
    note: str | None
    source: str
    created_at: str


class TodayHabitItem(BaseModel):
    id: str
    title: str
    frequency_type: str
    scheduled_today: bool
    checked_in: bool
    completed: bool
    value: float | None
    target_value: float | None
    target_unit: str | None
    streak: int
    note: str | None


class TodaySummary(BaseModel):
    date: str
    total: int
    completed: int
    habits: list[TodayHabitItem]


# --- Helpers ---


def _habit_response(habit) -> HabitResponse:
    return HabitResponse(
        id=str(habit.id),
        title=habit.title,
        description=habit.description,
        frequency_type=habit.frequency_type,
        frequency_value=habit.frequency_value or {},
        target_value=habit.target_value,
        target_unit=habit.target_unit,
        status=habit.status,
        goal_id=str(habit.goal_id) if habit.goal_id else None,
        start_date=str(habit.start_date),
        sort_order=habit.sort_order,
        created_at=habit.created_at.isoformat(),
        updated_at=habit.updated_at.isoformat(),
    )


def _log_response(log) -> HabitLogResponse:
    return HabitLogResponse(
        id=str(log.id),
        habit_id=str(log.habit_id),
        log_date=str(log.log_date),
        completed=log.completed,
        value=log.value,
        note=log.note,
        source=log.source,
        created_at=log.created_at.isoformat(),
    )


# --- Routes (today MUST be before {habit_id}) ---


@router.get("/today", response_model=TodaySummary)
async def get_today_summary(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = HabitService(session)
    return await service.get_today_summary(user.id)


@router.get("", response_model=list[HabitResponse])
async def list_habits(
    status: str | None = None,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = HabitService(session)
    habits = await service.list_habits(user.id, status)
    return [_habit_response(h) for h in habits]


@router.post("", response_model=HabitResponse, status_code=201)
async def create_habit(
    req: HabitCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = HabitService(session)
    kwargs = {}
    if req.description:
        kwargs["description"] = req.description
    if req.target_value is not None:
        kwargs["target_value"] = req.target_value
    if req.target_unit:
        kwargs["target_unit"] = req.target_unit
    if req.goal_id:
        kwargs["goal_id"] = uuid.UUID(req.goal_id)

    start = date.fromisoformat(req.start_date) if req.start_date else date.today()

    habit = await service.create_habit(
        user.id, req.title,
        frequency_type=req.frequency_type,
        frequency_value=req.frequency_value,
        start_date=start,
        **kwargs,
    )
    return _habit_response(habit)


@router.get("/{habit_id}", response_model=HabitDetailResponse)
async def get_habit(
    habit_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = HabitService(session)
    habit = await service.get_habit(uuid.UUID(habit_id), user.id)
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    streak = await service.get_streak(habit, date.today())
    return HabitDetailResponse(**_habit_response(habit).model_dump(), streak=streak)


@router.put("/{habit_id}", response_model=HabitResponse)
async def update_habit(
    habit_id: str,
    req: HabitUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = HabitService(session)
    habit = await service.get_habit(uuid.UUID(habit_id), user.id)
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    updates = req.model_dump(exclude_none=True)
    habit = await service.update_habit(habit, **updates)
    return _habit_response(habit)


@router.delete("/{habit_id}", status_code=204)
async def delete_habit(
    habit_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = HabitService(session)
    habit = await service.get_habit(uuid.UUID(habit_id), user.id)
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    await service.delete_habit(habit.id)


@router.post("/{habit_id}/checkin", response_model=HabitLogResponse)
async def checkin_habit(
    habit_id: str,
    req: CheckinRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = HabitService(session)
    log = await service.checkin(
        uuid.UUID(habit_id), user.id,
        log_date=date.fromisoformat(req.log_date),
        completed=req.completed,
        value=req.value,
        note=req.note,
        source=req.source,
    )
    return _log_response(log)


@router.get("/{habit_id}/logs", response_model=list[HabitLogResponse])
async def get_habit_logs(
    habit_id: str,
    start: str | None = None,
    end: str | None = None,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = HabitService(session)
    habit = await service.get_habit(uuid.UUID(habit_id), user.id)
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    start_date = date.fromisoformat(start) if start else None
    end_date = date.fromisoformat(end) if end else None
    logs = await service.get_logs(habit.id, start_date, end_date)
    return [_log_response(l) for l in logs]
```

- [ ] **Step 2: main.py에 라우터 등록**

`backend/src/alma/main.py`에서 import 추가:
```python
from alma.api.habits import router as habits_router
```

`app.include_router(integrations_router)` 앞에 추가:
```python
app.include_router(habits_router)
```

- [ ] **Step 3: Ruff lint/format**

```bash
cd backend && ruff check src/alma/api/habits.py src/alma/main.py && ruff format src/alma/api/habits.py src/alma/main.py
```

- [ ] **Step 4: 전체 테스트 재실행**

```bash
cd backend && pytest tests/ -v
```
Expected: 기존 테스트 + habit 15개 모두 PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/src/alma/api/habits.py backend/src/alma/main.py
git commit -m "feat: habits API router with 7 endpoints + frequency validation"
```

---

## Task 5: 프론트엔드 타입 + API 훅 + NavBar/middleware 수정

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Create: `frontend/src/hooks/useHabits.ts`
- Modify: `frontend/src/components/common/NavBar.tsx`
- Modify: `frontend/src/middleware.ts`

- [ ] **Step 1: TypeScript 타입 추가**

`frontend/src/lib/types.ts` 끝에 추가:

```typescript
// ─── Habits ───

export type FrequencyType = "daily" | "specific_days" | "times_per_week" | "every_n_days";
export type HabitStatus = "active" | "paused" | "archived";

export interface Habit {
  id: string;
  title: string;
  description: string | null;
  frequency_type: FrequencyType;
  frequency_value: Record<string, unknown>;
  target_value: number | null;
  target_unit: string | null;
  status: HabitStatus;
  goal_id: string | null;
  start_date: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface HabitDetail extends Habit {
  streak: number;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  log_date: string;
  completed: boolean;
  value: number | null;
  note: string | null;
  source: string;
  created_at: string;
}

export interface HabitCreate {
  title: string;
  description?: string;
  frequency_type?: FrequencyType;
  frequency_value?: Record<string, unknown>;
  target_value?: number;
  target_unit?: string;
  goal_id?: string;
  start_date?: string;
}

export interface TodayHabitItem {
  id: string;
  title: string;
  frequency_type: string;
  scheduled_today: boolean;
  checked_in: boolean;
  completed: boolean;
  value: number | null;
  target_value: number | null;
  target_unit: string | null;
  streak: number;
  note: string | null;
}

export interface TodaySummary {
  date: string;
  total: number;
  completed: number;
  habits: TodayHabitItem[];
}
```

- [ ] **Step 2: useHabits 훅 생성**

```typescript
// frontend/src/hooks/useHabits.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { Habit, HabitCreate, HabitLog, TodaySummary } from "@/lib/types";

export function useHabits() {
  const { token } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [habitsData, summary] = await Promise.all([
        apiClient<Habit[]>("/api/habits?status=active", { token }),
        apiClient<TodaySummary>("/api/habits/today", { token }),
      ]);
      setHabits(habitsData);
      setTodaySummary(summary);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createHabit = async (data: HabitCreate) => {
    if (!token) return;
    await apiClient<Habit>("/api/habits", {
      method: "POST",
      token,
      body: data,
    });
    await fetchData();
  };

  const updateHabit = async (id: string, data: Record<string, unknown>) => {
    if (!token) return;
    await apiClient<Habit>(`/api/habits/${id}`, {
      method: "PUT",
      token,
      body: data,
    });
    await fetchData();
  };

  const deleteHabit = async (id: string) => {
    if (!token) return;
    await apiClient(`/api/habits/${id}`, { method: "DELETE", token });
    await fetchData();
  };

  const checkin = async (
    habitId: string,
    logDate: string,
    completed: boolean,
    value?: number,
    note?: string
  ) => {
    if (!token) return;
    await apiClient<HabitLog>(`/api/habits/${habitId}/checkin`, {
      method: "POST",
      token,
      body: { log_date: logDate, completed, value, note },
    });
    await fetchData();
  };

  return {
    habits,
    todaySummary,
    loading,
    createHabit,
    updateHabit,
    deleteHabit,
    checkin,
    refresh: fetchData,
  };
}
```

- [ ] **Step 3: NavBar에 습관 탭 추가**

`frontend/src/components/common/NavBar.tsx`의 navItems 배열을 수정:

```typescript
const navItems = [
  { href: "/chat", label: "대화" },
  { href: "/goals", label: "목표" },
  { href: "/habits", label: "습관" },
  { href: "/insights", label: "인사이트" },
  { href: "/settings", label: "설정" },
];
```

- [ ] **Step 4: middleware.ts에 /habits 보호 추가**

```typescript
const protectedPaths = ["/chat", "/settings", "/goals", "/habits", "/insights"];
```

matcher에도 추가:
```typescript
export const config = {
  matcher: ["/", "/login", "/chat/:path*", "/settings/:path*", "/goals/:path*", "/habits/:path*", "/insights/:path*"],
};
```

- [ ] **Step 5: 빌드 확인**

```bash
cd frontend && npm run build
```
Expected: 빌드 성공 (habits 페이지는 아직 없어도 타입/훅/NavBar는 빌드 가능)

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/lib/types.ts frontend/src/hooks/useHabits.ts frontend/src/components/common/NavBar.tsx frontend/src/middleware.ts
git commit -m "feat: habit types, useHabits hook, NavBar tab, middleware protection"
```

---

## Task 6: 프론트엔드 — HabitTodaySummary + HabitCard + HabitForm 컴포넌트

**Files:**
- Create: `frontend/src/components/HabitTodaySummary.tsx`
- Create: `frontend/src/components/HabitCard.tsx`
- Create: `frontend/src/components/HabitForm.tsx`

- [ ] **Step 1: HabitTodaySummary 컴포넌트**

```tsx
// frontend/src/components/HabitTodaySummary.tsx
"use client";

import type { TodaySummary } from "@/lib/types";

interface Props {
  summary: TodaySummary | null;
}

export default function HabitTodaySummary({ summary }: Props) {
  if (!summary) return null;

  const pct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

  return (
    <div className="p-4 border-b dark:border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">오늘의 습관</span>
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {summary.completed}/{summary.total} 완료
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="bg-emerald-500 h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: HabitCard 컴포넌트**

```tsx
// frontend/src/components/HabitCard.tsx
"use client";

import { useState } from "react";
import type { TodayHabitItem } from "@/lib/types";

interface Props {
  item: TodayHabitItem;
  onCheckin: (completed: boolean, value?: number, note?: string) => Promise<void>;
  onEdit: () => void;
  onPause: () => void;
  onDelete: () => void;
}

export default function HabitCard({ item, onCheckin, onEdit, onPause, onDelete }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState(item.note || "");
  const [valueInput, setValueInput] = useState(item.value?.toString() || "");
  const [loading, setLoading] = useState(false);

  const hasTarget = item.target_value !== null;

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (hasTarget) {
        const val = parseFloat(valueInput) || 0;
        await onCheckin(val >= (item.target_value || 0), val, noteText || undefined);
      } else {
        await onCheckin(!item.completed, undefined, noteText || undefined);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleValueSubmit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const val = parseFloat(valueInput) || 0;
      await onCheckin(val >= (item.target_value || 0), val, noteText || undefined);
    } finally {
      setLoading(false);
    }
  };

  const pct = hasTarget && item.target_value
    ? Math.min(100, Math.round(((item.value || 0) / item.target_value) * 100))
    : 0;

  return (
    <div
      className={`p-4 rounded-xl border transition ${
        item.completed
          ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
          : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
      } ${!item.scheduled_today ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Checkbox / Toggle */}
          {!hasTarget && (
            <button
              onClick={handleToggle}
              disabled={loading}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
                item.completed
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "border-gray-300 dark:border-gray-600 hover:border-emerald-400"
              }`}
            >
              {item.completed && (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          )}
          <div>
            <span className={`font-medium ${item.completed ? "text-emerald-700 dark:text-emerald-400" : "text-gray-900 dark:text-gray-100"}`}>
              {item.title}
            </span>
            {item.streak > 0 && (
              <span className="ml-2 text-xs text-orange-500 font-medium">
                🔥 {item.streak}{item.frequency_type === "times_per_week" ? "주" : "일"}
              </span>
            )}
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg z-10 py-1 min-w-[100px]">
              <button onClick={() => { onEdit(); setShowMenu(false); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700">수정</button>
              <button onClick={() => { onPause(); setShowMenu(false); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700">일시정지</button>
              <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700">삭제</button>
            </div>
          )}
        </div>
      </div>

      {/* Value input for target habits */}
      {hasTarget && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={valueInput}
              onChange={(e) => setValueInput(e.target.value)}
              onBlur={handleValueSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleValueSubmit()}
              className="w-20 px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-700"
              placeholder="0"
            />
            <span className="text-sm text-gray-500">
              / {item.target_value} {item.target_unit}
            </span>
          </div>
          <div className="mt-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Note toggle */}
      <button
        onClick={() => setShowNote(!showNote)}
        className="mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        {showNote ? "메모 접기" : "메모"}
      </button>
      {showNote && (
        <input
          type="text"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onBlur={() => item.checked_in && onCheckin(item.completed, item.value ?? undefined, noteText || undefined)}
          placeholder="짧은 메모..."
          className="mt-1 w-full px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-700"
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: HabitForm 모달 컴포넌트**

```tsx
// frontend/src/components/HabitForm.tsx
"use client";

import { useState } from "react";
import type { HabitCreate, FrequencyType } from "@/lib/types";

interface Props {
  onSubmit: (data: HabitCreate) => Promise<void>;
  onClose: () => void;
  initial?: Partial<HabitCreate>;
}

const FREQ_OPTIONS: { value: FrequencyType; label: string }[] = [
  { value: "daily", label: "매일" },
  { value: "specific_days", label: "특정 요일" },
  { value: "times_per_week", label: "주 N회" },
  { value: "every_n_days", label: "N일마다" },
];

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export default function HabitForm({ onSubmit, onClose, initial }: Props) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [freqType, setFreqType] = useState<FrequencyType>(initial?.frequency_type || "daily");
  const [days, setDays] = useState<number[]>((initial?.frequency_value?.days as number[]) || []);
  const [times, setTimes] = useState((initial?.frequency_value?.times as number) || 3);
  const [intervalDays, setIntervalDays] = useState((initial?.frequency_value?.interval as number) || 2);
  const [targetValue, setTargetValue] = useState(initial?.target_value?.toString() || "");
  const [targetUnit, setTargetUnit] = useState(initial?.target_unit || "");
  const [submitting, setSubmitting] = useState(false);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const handleSubmit = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      let frequency_value: Record<string, unknown> = {};
      if (freqType === "specific_days") frequency_value = { days };
      if (freqType === "times_per_week") frequency_value = { times };
      if (freqType === "every_n_days") frequency_value = { interval: intervalDays };

      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        frequency_type: freqType,
        frequency_value,
        target_value: targetValue ? parseFloat(targetValue) : undefined,
        target_unit: targetUnit.trim() || undefined,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {initial ? "습관 수정" : "새 습관"}
        </h2>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="습관 이름"
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          autoFocus
        />

        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="설명 (선택)"
          className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
        />

        {/* Frequency type */}
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">반복 주기</label>
          <div className="grid grid-cols-2 gap-2">
            {FREQ_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFreqType(opt.value)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                  freqType === opt.value
                    ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400"
                    : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Frequency value */}
        {freqType === "specific_days" && (
          <div className="flex gap-1">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                className={`w-9 h-9 rounded-full text-sm font-medium transition ${
                  days.includes(i)
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {freqType === "times_per_week" && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">주</span>
            <input
              type="number"
              min={1}
              max={7}
              value={times}
              onChange={(e) => setTimes(parseInt(e.target.value) || 1)}
              className="w-16 px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">회</span>
          </div>
        )}
        {freqType === "every_n_days" && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={intervalDays}
              onChange={(e) => setIntervalDays(parseInt(e.target.value) || 1)}
              className="w-16 px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">일마다</span>
          </div>
        )}

        {/* Target value */}
        <div>
          <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">목표량 (선택)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="예: 8"
              className="w-24 px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700"
            />
            <input
              type="text"
              value={targetUnit}
              onChange={(e) => setTargetUnit(e.target.value)}
              placeholder="단위 (잔, 분...)"
              className="flex-1 px-2 py-1 border rounded dark:bg-gray-800 dark:border-gray-700"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
            className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
          >
            {submitting ? "저장 중..." : initial ? "수정" : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/HabitTodaySummary.tsx frontend/src/components/HabitCard.tsx frontend/src/components/HabitForm.tsx
git commit -m "feat: HabitTodaySummary + HabitCard + HabitForm components"
```

---

## Task 7: 프론트엔드 — /habits 페이지 + 빌드 검증 + 최종 커밋

**Files:**
- Create: `frontend/src/app/habits/page.tsx`

- [ ] **Step 1: /habits 페이지 구현**

```tsx
// frontend/src/app/habits/page.tsx
"use client";

import { useState } from "react";
import NavBar from "@/components/common/NavBar";
import HabitCard from "@/components/HabitCard";
import HabitForm from "@/components/HabitForm";
import HabitTodaySummary from "@/components/HabitTodaySummary";
import { useAuth } from "@/contexts/AuthContext";
import { useHabits } from "@/hooks/useHabits";
import type { HabitCreate } from "@/lib/types";

export default function HabitsPage() {
  const { isLoading: authLoading } = useAuth();
  const { habits, todaySummary, loading, createHabit, updateHabit, deleteHabit, checkin } = useHabits();
  const [showCreate, setShowCreate] = useState(false);
  const [editingHabit, setEditingHabit] = useState<string | null>(null);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-gray-400">로딩 중...</span>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const todayMap = new Map(todaySummary?.habits.map((h) => [h.id, h]));

  // Sort: scheduled today first, then by sort_order
  const sortedHabits = [...habits].sort((a, b) => {
    const aScheduled = todayMap.get(a.id)?.scheduled_today ? 0 : 1;
    const bScheduled = todayMap.get(b.id)?.scheduled_today ? 0 : 1;
    if (aScheduled !== bScheduled) return aScheduled - bScheduled;
    return a.sort_order - b.sort_order;
  });

  return (
    <div className="flex flex-col h-screen">
      <NavBar />
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
        <div className="max-w-2xl mx-auto">
          <HabitTodaySummary summary={todaySummary} />
          <div className="p-4 space-y-3">
            {sortedHabits.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg mb-2">아직 습관이 없습니다</p>
                <p className="text-sm">+ 버튼을 눌러 첫 습관을 추가해보세요</p>
              </div>
            ) : (
              sortedHabits.map((habit) => {
                const todayItem = todayMap.get(habit.id);
                const item = todayItem || {
                  id: habit.id,
                  title: habit.title,
                  frequency_type: habit.frequency_type,
                  scheduled_today: false,
                  checked_in: false,
                  completed: false,
                  value: null,
                  target_value: habit.target_value,
                  target_unit: habit.target_unit,
                  streak: 0,
                  note: null,
                };
                return (
                  <HabitCard
                    key={habit.id}
                    item={item}
                    onCheckin={async (completed, value, note) => {
                      await checkin(habit.id, today, completed, value, note);
                    }}
                    onEdit={() => setEditingHabit(habit.id)}
                    onPause={() => updateHabit(habit.id, { status: "paused" })}
                    onDelete={() => {
                      if (confirm("이 습관을 삭제하시겠습니까?")) {
                        deleteHabit(habit.id);
                      }
                    }}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* FAB */}
        <button
          onClick={() => setShowCreate(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-500 text-white rounded-full shadow-lg hover:bg-emerald-600 transition flex items-center justify-center text-2xl"
        >
          +
        </button>

        {showCreate && (
          <HabitForm
            onSubmit={createHabit}
            onClose={() => setShowCreate(false)}
          />
        )}

        {editingHabit && (() => {
          const h = habits.find((x) => x.id === editingHabit);
          return h ? (
            <HabitForm
              initial={{
                title: h.title,
                description: h.description || undefined,
                frequency_type: h.frequency_type,
                frequency_value: h.frequency_value,
                target_value: h.target_value || undefined,
                target_unit: h.target_unit || undefined,
              }}
              onSubmit={async (data) => {
                await updateHabit(editingHabit, data);
              }}
              onClose={() => setEditingHabit(null)}
            />
          ) : null;
        })()}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 프론트엔드 빌드 확인**

```bash
cd frontend && npm run build
```
Expected: 빌드 성공

- [ ] **Step 3: 프론트엔드 lint**

```bash
cd frontend && npm run lint
```

- [ ] **Step 4: 백엔드 전체 테스트 최종 확인**

```bash
cd backend && ruff check src/ tests/ && pytest tests/ -v
```
Expected: lint 클린 + 모든 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/app/habits/page.tsx
git commit -m "feat: /habits page with today summary, habit cards, and create form"
```

- [ ] **Step 6: 최종 푸시**

```bash
git push origin feature/phase1-mvp
```
