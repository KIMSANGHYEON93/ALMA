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
    language: Literal["ko", "en", "ja"] | None = None
    response_style: Literal["concise", "detailed", "casual", "professional"] | None = None
    interests: list[str] | None = None
    timezone: str | None = None
    llm_model: Literal["claude", "openai", "gemini"] | None = None
    telegram_id: str | None = None
    discord_id: str | None = None
    google_client_id: str | None = None
    google_client_secret: str | None = None


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
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    return await service.update_preferences(str(user.id), updates)
