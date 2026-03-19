from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.dependencies import get_current_user
from alma.database import get_session
from alma.domain.growth.repository import MilestoneRepository
from alma.domain.growth.service import GoalService
from alma.models.models import User

router = APIRouter(prefix="/api/goals", tags=["goals"])


# --- Schemas ---


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


# --- Helpers ---


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


# --- Routes (summary MUST be before {goal_id} to avoid collision) ---


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
    goal = await service.create_goal(
        user.id, req.title, description=req.description,
        category=req.category, target_date=req.target_date,
    )
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
    ms = await service.add_milestone(
        goal.id, req.title, description=req.description, sort_order=req.sort_order,
    )
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
