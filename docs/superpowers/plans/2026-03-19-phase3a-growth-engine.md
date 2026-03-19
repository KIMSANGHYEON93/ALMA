# Growth Engine Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 목표 관리 시스템 (Goal + Milestone CRUD, ChatService 연동, 자동 progress 계산)

**Architecture:** DDD growth 바운디드 컨텍스트 추가. ORM 모델은 Shared Kernel (models/models.py)에, 값 객체는 domain/growth/models.py에 배치. API 라우터에서 GoalService를 직접 인스턴스화. ChatService에 optional GoalService 주입으로 기존 테스트 호환.

**Tech Stack:** Python, FastAPI, SQLAlchemy 2.0 async, Alembic, pytest-asyncio, Supabase PostgreSQL

**Spec:** `docs/superpowers/specs/2026-03-19-phase3a-growth-engine.md`

---

## File Structure

### Create
| File | Responsibility |
|------|----------------|
| `backend/src/alma/domain/growth/__init__.py` | Package marker |
| `backend/src/alma/domain/growth/models.py` | GoalStatus, GoalCategory Enum 값 객체 |
| `backend/src/alma/domain/growth/repository.py` | GoalRepository, MilestoneRepository, GoalConversationLinkRepository |
| `backend/src/alma/domain/growth/service.py` | GoalService (CRUD + progress 계산 + 대화 연동) |
| `backend/src/alma/api/goals.py` | Goals API 라우터 (11 endpoints) |
| `backend/tests/test_goal_service.py` | GoalService 단위 테스트 |
| `backend/tests/test_goal_api.py` | Goals API 통합 테스트 |
| `backend/tests/test_goal_chat_integration.py` | ChatService 목표 감지 연동 테스트 |

### Modify
| File | Change |
|------|--------|
| `backend/src/alma/models/models.py` | Goal, Milestone, GoalConversationLink ORM 모델 추가 |
| `backend/src/alma/main.py` | goals_router 등록 |
| `backend/src/alma/domain/chat/service.py` | optional GoalService 주입 + 목표 컨텍스트 |
| `backend/src/alma/domain/integration/service.py` | 통합 감지 프롬프트 (action + goal) |

---

## Chunk 1: DB 모델 + Repository + 기본 테스트

### Task 1: ORM 모델 추가

**Files:**
- Modify: `backend/src/alma/models/models.py`
- Create: `backend/src/alma/domain/growth/__init__.py`
- Create: `backend/src/alma/domain/growth/models.py`

- [ ] **Step 1: Growth Enum 값 객체 작성**

```python
# backend/src/alma/domain/growth/models.py
from enum import Enum


class GoalStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    PAUSED = "paused"
    ABANDONED = "abandoned"


class GoalCategory(str, Enum):
    PERSONAL = "personal"
    CAREER = "career"
    HEALTH = "health"
    LEARNING = "learning"
    FINANCE = "finance"
    OTHER = "other"
```

- [ ] **Step 2: `__init__.py` 생성**

```python
# backend/src/alma/domain/growth/__init__.py
```

- [ ] **Step 3: ORM 모델을 models/models.py에 추가**

`models/models.py` 하단에 추가:

```python
class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(nullable=False, default="other")
    status: Mapped[str] = mapped_column(nullable=False, default="active")
    target_date = mapped_column(nullable=True)
    progress: Mapped[int] = mapped_column(default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    milestones: Mapped[list["Milestone"]] = relationship(
        back_populates="goal", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("idx_goals_user", "user_id", "status"),)


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    goal_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("goals.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(nullable=False, default="pending")
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    goal: Mapped["Goal"] = relationship(back_populates="milestones")

    __table_args__ = (Index("idx_milestones_goal", "goal_id", "sort_order"),)


class GoalConversationLink(Base):
    __tablename__ = "goal_conversation_links"

    goal_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("goals.id", ondelete="CASCADE"), primary_key=True
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True
    )
    relevance_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
```

- [ ] **Step 4: Alembic 마이그레이션 생성 및 실행**

Run:
```bash
cd backend
DATABASE_URL="$DATABASE_URL" alembic revision --autogenerate -m "add goals milestones tables"
```
마이그레이션 파일 확인 후:
```bash
DATABASE_URL="$DATABASE_URL" alembic upgrade head
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/alma/models/models.py backend/src/alma/domain/growth/
git commit -m "feat: add Goal, Milestone ORM models and growth domain enums"
```

---

### Task 2: Repository 구현

**Files:**
- Create: `backend/src/alma/domain/growth/repository.py`
- Create: `backend/tests/test_goal_service.py`

- [ ] **Step 1: Repository 작성**

```python
# backend/src/alma/domain/growth/repository.py
import uuid
from datetime import datetime

from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from alma.models.models import Goal, Milestone, GoalConversationLink


class GoalRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, user_id: uuid.UUID, title: str, description: str | None = None,
                     category: str = "other", target_date=None) -> Goal:
        goal = Goal(user_id=user_id, title=title, description=description,
                    category=category, target_date=target_date)
        self.session.add(goal)
        await self.session.commit()
        await self.session.refresh(goal)
        return goal

    async def get(self, goal_id: uuid.UUID) -> Goal | None:
        result = await self.session.execute(
            select(Goal).where(Goal.id == goal_id)
        )
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: uuid.UUID, status: str | None = None,
                           category: str | None = None) -> list[Goal]:
        query = select(Goal).where(Goal.user_id == user_id)
        if status:
            query = query.where(Goal.status == status)
        if category:
            query = query.where(Goal.category == category)
        query = query.order_by(desc(Goal.updated_at))
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def update(self, goal: Goal) -> Goal:
        await self.session.commit()
        await self.session.refresh(goal)
        return goal

    async def delete(self, goal_id: uuid.UUID) -> None:
        goal = await self.get(goal_id)
        if goal:
            await self.session.delete(goal)
            await self.session.commit()

    async def get_summary(self, user_id: uuid.UUID) -> dict:
        result = await self.session.execute(
            select(
                func.count(Goal.id).label("total"),
                func.count(Goal.id).filter(Goal.status == "active").label("active"),
                func.avg(Goal.progress).label("avg_progress"),
            ).where(Goal.user_id == user_id)
        )
        row = result.one()
        return {
            "total_goals": row.total,
            "active_goals": row.active,
            "average_progress": int(row.avg_progress or 0),
        }


class MilestoneRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, goal_id: uuid.UUID, title: str, description: str | None = None,
                     sort_order: int = 0) -> Milestone:
        milestone = Milestone(goal_id=goal_id, title=title, description=description,
                              sort_order=sort_order)
        self.session.add(milestone)
        await self.session.commit()
        await self.session.refresh(milestone)
        return milestone

    async def get(self, milestone_id: uuid.UUID) -> Milestone | None:
        result = await self.session.execute(
            select(Milestone).where(Milestone.id == milestone_id)
        )
        return result.scalar_one_or_none()

    async def list_by_goal(self, goal_id: uuid.UUID) -> list[Milestone]:
        result = await self.session.execute(
            select(Milestone).where(Milestone.goal_id == goal_id)
            .order_by(Milestone.sort_order)
        )
        return list(result.scalars().all())

    async def update(self, milestone: Milestone) -> Milestone:
        await self.session.commit()
        await self.session.refresh(milestone)
        return milestone

    async def complete(self, milestone: Milestone) -> Milestone:
        milestone.status = "completed"
        milestone.completed_at = datetime.utcnow()
        return await self.update(milestone)

    async def delete(self, milestone_id: uuid.UUID) -> None:
        milestone = await self.get(milestone_id)
        if milestone:
            await self.session.delete(milestone)
            await self.session.commit()


class GoalConversationLinkRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def link(self, goal_id: uuid.UUID, conversation_id: uuid.UUID,
                   relevance_note: str | None = None) -> GoalConversationLink:
        link = GoalConversationLink(
            goal_id=goal_id, conversation_id=conversation_id,
            relevance_note=relevance_note
        )
        self.session.add(link)
        await self.session.commit()
        return link
```

- [ ] **Step 2: 기본 테스트 작성**

```python
# backend/tests/test_goal_service.py
import pytest
from alma.domain.growth.repository import GoalRepository, MilestoneRepository
from alma.domain.growth.models import GoalStatus, GoalCategory


@pytest.mark.asyncio
async def test_create_goal(db_session, test_user):
    repo = GoalRepository(db_session)
    goal = await repo.create(test_user.id, "Learn Python", category="learning")
    assert goal.title == "Learn Python"
    assert goal.category == "learning"
    assert goal.status == "active"
    assert goal.progress == 0


@pytest.mark.asyncio
async def test_list_goals_by_user(db_session, test_user):
    repo = GoalRepository(db_session)
    await repo.create(test_user.id, "Goal 1", category="personal")
    await repo.create(test_user.id, "Goal 2", category="health")
    goals = await repo.list_by_user(test_user.id)
    assert len(goals) == 2


@pytest.mark.asyncio
async def test_list_goals_filter_status(db_session, test_user):
    repo = GoalRepository(db_session)
    g1 = await repo.create(test_user.id, "Active Goal")
    g2 = await repo.create(test_user.id, "Paused Goal")
    g2.status = "paused"
    await repo.update(g2)
    active = await repo.list_by_user(test_user.id, status="active")
    assert len(active) == 1


@pytest.mark.asyncio
async def test_milestone_crud(db_session, test_user):
    goal_repo = GoalRepository(db_session)
    ms_repo = MilestoneRepository(db_session)
    goal = await goal_repo.create(test_user.id, "Test Goal")
    m1 = await ms_repo.create(goal.id, "Step 1", sort_order=0)
    m2 = await ms_repo.create(goal.id, "Step 2", sort_order=1)
    milestones = await ms_repo.list_by_goal(goal.id)
    assert len(milestones) == 2
    assert milestones[0].title == "Step 1"


@pytest.mark.asyncio
async def test_milestone_complete(db_session, test_user):
    goal_repo = GoalRepository(db_session)
    ms_repo = MilestoneRepository(db_session)
    goal = await goal_repo.create(test_user.id, "Test Goal")
    m1 = await ms_repo.create(goal.id, "Step 1")
    completed = await ms_repo.complete(m1)
    assert completed.status == "completed"
    assert completed.completed_at is not None


@pytest.mark.asyncio
async def test_goal_summary(db_session, test_user):
    repo = GoalRepository(db_session)
    await repo.create(test_user.id, "Goal 1")
    await repo.create(test_user.id, "Goal 2")
    summary = await repo.get_summary(test_user.id)
    assert summary["total_goals"] == 2
    assert summary["active_goals"] == 2


@pytest.mark.asyncio
async def test_goal_delete_cascades(db_session, test_user):
    goal_repo = GoalRepository(db_session)
    ms_repo = MilestoneRepository(db_session)
    goal = await goal_repo.create(test_user.id, "Test Goal")
    await ms_repo.create(goal.id, "Step 1")
    await goal_repo.delete(goal.id)
    milestones = await ms_repo.list_by_goal(goal.id)
    assert len(milestones) == 0
```

- [ ] **Step 3: 테스트 실행**

Run: `cd backend && python -m pytest tests/test_goal_service.py -v`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/alma/domain/growth/repository.py backend/tests/test_goal_service.py
git commit -m "feat: add GoalRepository, MilestoneRepository with tests"
```

---

### Task 3: GoalService 구현

**Files:**
- Create: `backend/src/alma/domain/growth/service.py`

- [ ] **Step 1: GoalService 작성**

```python
# backend/src/alma/domain/growth/service.py
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.growth.repository import (
    GoalRepository, MilestoneRepository, GoalConversationLinkRepository
)
from alma.models.models import Goal, Milestone


class GoalService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.goal_repo = GoalRepository(session)
        self.milestone_repo = MilestoneRepository(session)
        self.link_repo = GoalConversationLinkRepository(session)

    @staticmethod
    def calculate_progress(milestones: list[Milestone]) -> int:
        if not milestones:
            return 0
        completed = sum(1 for m in milestones if m.status == "completed")
        return min(100, int(completed / len(milestones) * 100))

    async def create_goal(self, user_id: uuid.UUID, title: str, **kwargs) -> Goal:
        return await self.goal_repo.create(user_id, title, **kwargs)

    async def get_goal(self, goal_id: uuid.UUID, user_id: uuid.UUID) -> Goal | None:
        goal = await self.goal_repo.get(goal_id)
        if goal and goal.user_id == user_id:
            return goal
        return None

    async def list_goals(self, user_id: uuid.UUID, status: str | None = None,
                         category: str | None = None) -> list[Goal]:
        return await self.goal_repo.list_by_user(user_id, status, category)

    async def update_goal(self, goal: Goal, **kwargs) -> Goal:
        for key, value in kwargs.items():
            if hasattr(goal, key):
                setattr(goal, key, value)
        return await self.goal_repo.update(goal)

    async def delete_goal(self, goal_id: uuid.UUID) -> None:
        await self.goal_repo.delete(goal_id)

    async def update_goal_status(self, goal: Goal, status: str) -> Goal:
        goal.status = status
        return await self.goal_repo.update(goal)

    async def add_milestone(self, goal_id: uuid.UUID, title: str, **kwargs) -> Milestone:
        return await self.milestone_repo.create(goal_id, title, **kwargs)

    async def complete_milestone(self, milestone: Milestone, goal: Goal) -> tuple[Milestone, Goal, bool]:
        """Returns (milestone, goal, suggest_complete)"""
        milestone = await self.milestone_repo.complete(milestone)
        milestones = await self.milestone_repo.list_by_goal(goal.id)
        goal.progress = self.calculate_progress(milestones)
        goal = await self.goal_repo.update(goal)
        suggest_complete = goal.progress == 100
        return milestone, goal, suggest_complete

    async def delete_milestone(self, milestone_id: uuid.UUID, goal: Goal) -> Goal:
        await self.milestone_repo.delete(milestone_id)
        milestones = await self.milestone_repo.list_by_goal(goal.id)
        goal.progress = self.calculate_progress(milestones)
        return await self.goal_repo.update(goal)

    async def get_summary(self, user_id: uuid.UUID) -> dict:
        return await self.goal_repo.get_summary(user_id)

    async def get_active_goals_context(self, user_id: uuid.UUID, limit: int = 5) -> str:
        """ChatService용 활성 목표 컨텍스트 문자열"""
        goals = await self.goal_repo.list_by_user(user_id, status="active")
        if not goals:
            return ""
        goals = goals[:limit]
        lines = [f"- {g.title} ({g.progress}%, {g.category})" for g in goals]
        return "Active goals:\n" + "\n".join(lines)

    async def link_conversation(self, goal_id: uuid.UUID, conversation_id: uuid.UUID,
                                relevance_note: str | None = None):
        return await self.link_repo.link(goal_id, conversation_id, relevance_note)
```

- [ ] **Step 2: progress 계산 테스트 추가**

`test_goal_service.py`에 추가:
```python
from alma.domain.growth.service import GoalService


@pytest.mark.asyncio
async def test_progress_calculation_empty(db_session, test_user):
    service = GoalService(db_session)
    assert service.calculate_progress([]) == 0


@pytest.mark.asyncio
async def test_progress_calculation(db_session, test_user):
    service = GoalService(db_session)
    goal = await service.create_goal(test_user.id, "Test")
    await service.add_milestone(goal.id, "M1")
    await service.add_milestone(goal.id, "M2")
    m3 = await service.add_milestone(goal.id, "M3")
    ms_repo = MilestoneRepository(db_session)
    await ms_repo.complete(m3)
    milestones = await ms_repo.list_by_goal(goal.id)
    assert service.calculate_progress(milestones) == 33


@pytest.mark.asyncio
async def test_complete_milestone_updates_progress(db_session, test_user):
    service = GoalService(db_session)
    goal = await service.create_goal(test_user.id, "Test")
    m1 = await service.add_milestone(goal.id, "M1")
    m1_obj = await MilestoneRepository(db_session).get(m1.id)
    milestone, updated_goal, suggest = await service.complete_milestone(m1_obj, goal)
    assert updated_goal.progress == 100
    assert suggest is True


@pytest.mark.asyncio
async def test_ownership_check(db_session, test_user):
    service = GoalService(db_session)
    goal = await service.create_goal(test_user.id, "Test")
    import uuid
    other_user_id = uuid.uuid4()
    result = await service.get_goal(goal.id, other_user_id)
    assert result is None
```

- [ ] **Step 3: 테스트 실행**

Run: `cd backend && python -m pytest tests/test_goal_service.py -v`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/alma/domain/growth/service.py backend/tests/test_goal_service.py
git commit -m "feat: add GoalService with progress calculation and ownership check"
```

---

## Chunk 2: API 라우터 + ChatService 연동

### Task 4: Goals API 라우터

**Files:**
- Create: `backend/src/alma/api/goals.py`
- Modify: `backend/src/alma/main.py`
- Create: `backend/tests/test_goal_api.py`

- [ ] **Step 1: API 라우터 작성**

```python
# backend/src/alma/api/goals.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Literal

from alma.auth.dependencies import get_current_user
from alma.database import get_session
from alma.models.models import User
from alma.domain.growth.service import GoalService

router = APIRouter(prefix="/api/goals", tags=["goals"])


class GoalCreate(BaseModel):
    title: str = Field(min_length=1)
    description: str | None = None
    category: Literal["personal", "career", "health", "learning", "finance", "other"] = "other"
    target_date: str | None = None


class GoalUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1)
    description: str | None = None
    category: Literal["personal", "career", "health", "learning", "finance", "other"] | None = None
    target_date: str | None = None


class GoalStatusUpdate(BaseModel):
    status: Literal["completed", "paused", "abandoned"]


class MilestoneCreate(BaseModel):
    title: str = Field(min_length=1)
    description: str | None = None
    sort_order: int = 0


class MilestoneUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1)
    description: str | None = None
    sort_order: int | None = None


class MilestoneResponse(BaseModel):
    id: str
    title: str
    description: str | None
    status: str
    sort_order: int
    completed_at: str | None
    model_config = {"from_attributes": True}


class GoalResponse(BaseModel):
    id: str
    title: str
    description: str | None
    category: str
    status: str
    target_date: str | None
    progress: int
    created_at: str
    updated_at: str
    model_config = {"from_attributes": True}


class GoalDetailResponse(GoalResponse):
    milestones: list[MilestoneResponse]
    suggest_complete: bool = False


class GoalSummaryResponse(BaseModel):
    total_goals: int
    active_goals: int
    average_progress: int


# summary MUST be before {goal_id} to avoid route collision
@router.get("/summary", response_model=GoalSummaryResponse)
async def get_goal_summary(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = GoalService(session)
    return await service.get_summary(user.id)


@router.get("", response_model=list[GoalResponse])
async def list_goals(
    status: str | None = None,
    category: str | None = None,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = GoalService(session)
    goals = await service.list_goals(user.id, status, category)
    return [_goal_response(g) for g in goals]


@router.post("", response_model=GoalResponse, status_code=201)
async def create_goal(
    req: GoalCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = GoalService(session)
    goal = await service.create_goal(user.id, req.title, description=req.description,
                                     category=req.category, target_date=req.target_date)
    return _goal_response(goal)


@router.get("/{goal_id}", response_model=GoalDetailResponse)
async def get_goal(
    goal_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = GoalService(session)
    goal = await service.get_goal(goal_id, user.id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    from alma.domain.growth.repository import MilestoneRepository
    milestones = await MilestoneRepository(session).list_by_goal(goal.id)
    return GoalDetailResponse(
        **_goal_response(goal).model_dump(),
        milestones=[_milestone_response(m) for m in milestones],
        suggest_complete=goal.progress == 100 and goal.status == "active",
    )


@router.put("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: str,
    req: GoalUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = GoalService(session)
    goal = await service.get_goal(goal_id, user.id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    updates = req.model_dump(exclude_none=True)
    goal = await service.update_goal(goal, **updates)
    return _goal_response(goal)


@router.delete("/{goal_id}", status_code=204)
async def delete_goal(
    goal_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = GoalService(session)
    goal = await service.get_goal(goal_id, user.id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    await service.delete_goal(goal.id)


@router.patch("/{goal_id}/status", response_model=GoalResponse)
async def update_goal_status(
    goal_id: str,
    req: GoalStatusUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = GoalService(session)
    goal = await service.get_goal(goal_id, user.id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    goal = await service.update_goal_status(goal, req.status)
    return _goal_response(goal)


@router.post("/{goal_id}/milestones", response_model=MilestoneResponse, status_code=201)
async def add_milestone(
    goal_id: str,
    req: MilestoneCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = GoalService(session)
    goal = await service.get_goal(goal_id, user.id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    ms = await service.add_milestone(goal.id, req.title, description=req.description,
                                     sort_order=req.sort_order)
    return _milestone_response(ms)


@router.put("/{goal_id}/milestones/{milestone_id}", response_model=MilestoneResponse)
async def update_milestone(
    goal_id: str,
    milestone_id: str,
    req: MilestoneUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = GoalService(session)
    goal = await service.get_goal(goal_id, user.id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    from alma.domain.growth.repository import MilestoneRepository
    ms_repo = MilestoneRepository(session)
    ms = await ms_repo.get(milestone_id)
    if not ms or ms.goal_id != goal.id:
        raise HTTPException(status_code=404, detail="Milestone not found")
    updates = req.model_dump(exclude_none=True)
    for key, value in updates.items():
        setattr(ms, key, value)
    ms = await ms_repo.update(ms)
    return _milestone_response(ms)


@router.delete("/{goal_id}/milestones/{milestone_id}", status_code=204)
async def delete_milestone(
    goal_id: str,
    milestone_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = GoalService(session)
    goal = await service.get_goal(goal_id, user.id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    from alma.domain.growth.repository import MilestoneRepository
    ms = await MilestoneRepository(session).get(milestone_id)
    if not ms or ms.goal_id != goal.id:
        raise HTTPException(status_code=404, detail="Milestone not found")
    await service.delete_milestone(ms.id, goal)


@router.patch("/{goal_id}/milestones/{milestone_id}/complete", response_model=GoalDetailResponse)
async def complete_milestone(
    goal_id: str,
    milestone_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = GoalService(session)
    goal = await service.get_goal(goal_id, user.id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    from alma.domain.growth.repository import MilestoneRepository
    ms_repo = MilestoneRepository(session)
    ms = await ms_repo.get(milestone_id)
    if not ms or ms.goal_id != goal.id:
        raise HTTPException(status_code=404, detail="Milestone not found")
    _, updated_goal, suggest = await service.complete_milestone(ms, goal)
    milestones = await ms_repo.list_by_goal(goal.id)
    return GoalDetailResponse(
        **_goal_response(updated_goal).model_dump(),
        milestones=[_milestone_response(m) for m in milestones],
        suggest_complete=suggest,
    )


def _goal_response(goal) -> GoalResponse:
    return GoalResponse(
        id=str(goal.id),
        title=goal.title,
        description=goal.description,
        category=goal.category,
        status=goal.status,
        target_date=str(goal.target_date) if goal.target_date else None,
        progress=goal.progress,
        created_at=goal.created_at.isoformat(),
        updated_at=goal.updated_at.isoformat(),
    )


def _milestone_response(ms) -> MilestoneResponse:
    return MilestoneResponse(
        id=str(ms.id),
        title=ms.title,
        description=ms.description,
        status=ms.status,
        sort_order=ms.sort_order,
        completed_at=ms.completed_at.isoformat() if ms.completed_at else None,
    )
```

- [ ] **Step 2: main.py에 라우터 등록**

`backend/src/alma/main.py`에 추가:
```python
from alma.api.goals import router as goals_router
# ... 기존 라우터들 아래에
app.include_router(goals_router)
```

- [ ] **Step 3: API 테스트 작성**

```python
# backend/tests/test_goal_api.py
import pytest
from httpx import AsyncClient, ASGITransport
from alma.main import app


@pytest.mark.asyncio
async def test_create_goal_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/goals", json={"title": "Test"})
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_goal_empty_title_rejected(auth_client):
    resp = await auth_client.post("/api/goals", json={"title": ""})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_goal_invalid_category(auth_client):
    resp = await auth_client.post("/api/goals", json={"title": "Test", "category": "invalid"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_goal_crud_flow(auth_client):
    # Create
    resp = await auth_client.post("/api/goals", json={"title": "Learn Rust", "category": "learning"})
    assert resp.status_code == 201
    goal = resp.json()
    goal_id = goal["id"]

    # List
    resp = await auth_client.get("/api/goals")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

    # Get detail
    resp = await auth_client.get(f"/api/goals/{goal_id}")
    assert resp.status_code == 200
    assert resp.json()["milestones"] == []

    # Update
    resp = await auth_client.put(f"/api/goals/{goal_id}", json={"title": "Learn Rust & Go"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Learn Rust & Go"

    # Delete
    resp = await auth_client.delete(f"/api/goals/{goal_id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_milestone_flow(auth_client):
    # Create goal
    resp = await auth_client.post("/api/goals", json={"title": "Test Goal"})
    goal_id = resp.json()["id"]

    # Add milestone
    resp = await auth_client.post(f"/api/goals/{goal_id}/milestones",
                                   json={"title": "Step 1"})
    assert resp.status_code == 201
    ms_id = resp.json()["id"]

    # Complete milestone
    resp = await auth_client.patch(f"/api/goals/{goal_id}/milestones/{ms_id}/complete")
    assert resp.status_code == 200
    data = resp.json()
    assert data["progress"] == 100
    assert data["suggest_complete"] is True


@pytest.mark.asyncio
async def test_other_user_goal_returns_404(auth_client):
    import uuid
    fake_id = str(uuid.uuid4())
    resp = await auth_client.get(f"/api/goals/{fake_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_summary(auth_client):
    await auth_client.post("/api/goals", json={"title": "G1"})
    resp = await auth_client.get("/api/goals/summary")
    assert resp.status_code == 200
    assert resp.json()["active_goals"] >= 1
```

**Note:** `auth_client` fixture는 conftest.py에 추가 필요 — 인증된 AsyncClient를 제공. 기존 test_api_conversations.py 패턴 참고.

- [ ] **Step 4: 테스트 실행**

Run: `cd backend && python -m pytest tests/test_goal_api.py -v`
Expected: ALL PASS

- [ ] **Step 5: 전체 테스트 확인**

Run: `cd backend && python -m pytest -v`
Expected: 기존 27개 + 새 테스트 ALL PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/alma/api/goals.py backend/src/alma/main.py backend/tests/test_goal_api.py
git commit -m "feat: add Goals API router with 11 endpoints and tests"
```

---

### Task 5: ChatService 목표 연동

**Files:**
- Modify: `backend/src/alma/domain/chat/service.py`
- Modify: `backend/src/alma/domain/integration/service.py`
- Create: `backend/tests/test_goal_chat_integration.py`

- [ ] **Step 1: ChatService에 optional GoalService 추가**

`backend/src/alma/domain/chat/service.py` 수정:

```python
# __init__ 시그니처 변경
def __init__(self, session: AsyncSession, llm: LLMProvider, goal_service=None):
    self.session = session
    self.llm = llm
    embedding_provider = create_embedding_provider(settings)
    self.memory = MemoryService(session, embedding_provider)
    self.integration = IntegrationService(session, llm)
    self.profile = UserProfileService(session)
    self.goal_service = goal_service  # optional

# process_message 내 목표 컨텍스트 주입 (system prompt 구성 부분)
async def process_message(self, user_id: str, conversation_id: str, content: str) -> str:
    await self.memory.store_message(conversation_id, "user", content)
    similar = await self.memory.search_similar(user_id, content, limit=3)
    history = await self.memory.get_conversation_history(conversation_id, limit=10)

    messages: list[ChatMessage] = []
    if similar:
        context = "\n".join([f"[Past {m.role}]: {m.content}" for m in similar])
        messages.append(ChatMessage(role="user", content=f"[Relevant past context]\n{context}"))
        messages.append(ChatMessage(role="assistant", content="I'll keep this context in mind."))

    for msg in history:
        messages.append(msg)

    # 사용자 선호도
    preferences = await self.profile.get_preferences(user_id)
    safe_prefs = {
        "language": preferences.get("language", "ko"),
        "response_style": preferences.get("response_style", "concise"),
        "interests": preferences.get("interests", [])[:10],
    }
    personalized_prompt = SYSTEM_PROMPT + f"\n\nUser preferences: {json.dumps(safe_prefs)}"

    # 목표 컨텍스트 추가 (optional)
    if self.goal_service:
        goal_context = await self.goal_service.get_active_goals_context(user_id)
        if goal_context:
            personalized_prompt += f"\n\n{goal_context}"

    request = LLMRequest(messages=messages, system_prompt=personalized_prompt)
    response = await self.llm.complete(request)

    intent = await self.integration.detect_action_intent(response.content)
    action_note = ""
    if intent and intent.needs_confirmation:
        action_note = (
            f"\n\n---\n[Action: {intent.service}.{intent.action}"
            f"({intent.params}). 실행할까요? (예/아니오)]"
        )

    full_response = response.content + action_note
    await self.memory.store_message(conversation_id, "assistant", full_response)

    return full_response
```

- [ ] **Step 2: 연동 테스트 작성**

```python
# backend/tests/test_goal_chat_integration.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from alma.domain.chat.service import ChatService
from alma.domain.growth.service import GoalService


@pytest.mark.asyncio
async def test_chat_without_goal_service(db_session, test_user):
    """기존 동작: goal_service=None이면 목표 컨텍스트 없이 동작"""
    mock_llm = MagicMock()
    mock_llm.complete = AsyncMock(return_value=MagicMock(content="Hello!"))
    service = ChatService(db_session, mock_llm, goal_service=None)
    # goal_service 없어도 에러 없이 동작 확인
    assert service.goal_service is None


@pytest.mark.asyncio
async def test_chat_with_goal_service_injects_context(db_session, test_user):
    """GoalService 주입 시 system prompt에 목표 컨텍스트 포함"""
    goal_service = GoalService(db_session)
    await goal_service.create_goal(test_user.id, "Learn Python", category="learning")

    context = await goal_service.get_active_goals_context(str(test_user.id))
    assert "Learn Python" in context
    assert "learning" in context
```

- [ ] **Step 3: 기존 테스트 전체 실행**

Run: `cd backend && python -m pytest -v`
Expected: ALL PASS (기존 27개 + 새 테스트)

- [ ] **Step 4: Commit**

```bash
git add backend/src/alma/domain/chat/service.py backend/tests/test_goal_chat_integration.py
git commit -m "feat: integrate GoalService with ChatService (optional, backward compatible)"
```

---

### Task 6: 최종 검증 + CLAUDE.md/PROCESS.md 업데이트

- [ ] **Step 1: Lint 체크**

Run: `cd backend && ruff check src/ tests/`
Expected: No errors

- [ ] **Step 2: 전체 테스트**

Run: `cd backend && python -m pytest -v`
Expected: ALL PASS

- [ ] **Step 3: CLAUDE.md 아키텍처 섹션 업데이트**

`backend/src/alma/` 아키텍처에 growth 도메인 추가:
```
  growth/                 Bounded Context: 성장 관리
    service.py              GoalService (CRUD + progress + 대화 연동)
    repository.py           GoalRepo, MilestoneRepo
    models.py               GoalStatus, GoalCategory Enum
```

API 엔드포인트에 추가:
```
  goals.py                GET/POST/PUT/DELETE /api/goals, milestones, summary
```

- [ ] **Step 4: PROCESS.md 업데이트**

Phase 3A 완료 기록 추가.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: complete Phase 3A growth engine - goals, milestones, chat integration"
```
