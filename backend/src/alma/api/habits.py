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


def _log_response(log: object) -> HabitLogResponse:
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
        user.id,
        req.title,
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
        uuid.UUID(habit_id),
        user.id,
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
    return [_log_response(log) for log in logs]
