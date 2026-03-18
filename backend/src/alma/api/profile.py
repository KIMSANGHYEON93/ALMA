from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.dependencies import get_current_user
from alma.database import get_session
from alma.models.models import User
from alma.domain.identity.profile import UserProfileService

router = APIRouter(prefix="/api/users/me", tags=["profile"])


class PreferencesUpdate(BaseModel):
    language: Literal["ko", "en", "ja"] = "ko"
    response_style: Literal["concise", "detailed", "casual"] = "concise"
    interests: list[str] = []
    timezone: str = "Asia/Seoul"


@router.get("/preferences")
async def get_preferences(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = UserProfileService(session)
    return await service.get_preferences(str(user.id))


@router.put("/preferences")
async def update_preferences(
    body: PreferencesUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = UserProfileService(session)
    return await service.update_preferences(str(user.id), body.model_dump())
