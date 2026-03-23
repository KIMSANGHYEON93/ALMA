from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.dependencies import get_current_user
from alma.database import get_session
from alma.domain.habit.analytics import HabitAnalyticsService
from alma.infrastructure.llm.claude import ClaudeProvider
from alma.models.models import User

router = APIRouter(prefix="/api/habits/analytics", tags=["habit-analytics"])


@router.get("/heatmap")
async def get_heatmap(
    year: int = Query(default=None),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if year is None:
        year = date.today().year
    service = HabitAnalyticsService(session)
    return await service.get_heatmap(user.id, year)


@router.get("/trends")
async def get_trends(
    days: int = Query(default=30, ge=7, le=365),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = HabitAnalyticsService(session)
    return await service.get_trends(user.id, days)


@router.get("/completion")
async def get_completion(
    days: int = Query(default=30, ge=7, le=365),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = HabitAnalyticsService(session)
    return await service.get_completion(user.id, days)


@router.get("/correlations")
async def get_correlations(
    days: int = Query(default=30, ge=7, le=365),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = HabitAnalyticsService(session)
    return await service.get_correlations(user.id, days)


@router.post("/insight")
async def generate_insight(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    llm = ClaudeProvider()
    service = HabitAnalyticsService(session, llm=llm)
    return await service.generate_insight(user.id)
