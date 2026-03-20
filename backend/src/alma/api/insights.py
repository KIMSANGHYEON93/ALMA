import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.dependencies import get_current_user
from alma.database import get_session
from alma.domain.growth.service import GoalService
from alma.domain.insight.service import InsightService
from alma.infrastructure.llm.claude import ClaudeProvider
from alma.models.models import User

router = APIRouter(prefix="/api/insights", tags=["insights"])


class GenerateRequest(BaseModel):
    timezone: str = "Asia/Seoul"


@router.post("/retrospectives")
async def generate_retrospective(
    req: GenerateRequest | None = None,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    llm = ClaudeProvider()
    goal_service = GoalService(session)
    service = InsightService(session, llm, goal_service)
    retro = await service.generate_weekly_retrospective(user.id)
    return retro if isinstance(retro, dict) else service._retro_to_dict(retro)


@router.get("/retrospectives")
async def list_retrospectives(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    llm = ClaudeProvider()
    service = InsightService(session, llm)
    return await service.list_retrospectives(user.id)


@router.get("/retrospectives/{retro_id}")
async def get_retrospective(
    retro_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    llm = ClaudeProvider()
    service = InsightService(session, llm)
    result = await service.get_retrospective_detail(uuid.UUID(retro_id), user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Retrospective not found")
    return result


@router.get("/dashboard")
async def get_dashboard(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    llm = ClaudeProvider()
    goal_service = GoalService(session)
    service = InsightService(session, llm, goal_service)
    return await service.get_dashboard(user.id)
