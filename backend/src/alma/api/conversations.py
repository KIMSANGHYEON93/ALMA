from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.dependencies import get_current_user
from alma.database import get_session
from alma.models.models import User
from alma.repositories.repositories import ConversationRepository

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


class ConversationResponse(BaseModel):
    id: str
    title: str | None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class CreateConversationRequest(BaseModel):
    title: str | None = None


@router.get("", response_model=list[ConversationResponse])
async def list_conversations(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = ConversationRepository(session)
    convs = await repo.list_by_user(user.id)
    return [
        ConversationResponse(
            id=str(c.id),
            title=c.title,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
        )
        for c in convs
    ]


@router.post("", response_model=ConversationResponse, status_code=201)
async def create_conversation(
    req: CreateConversationRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = ConversationRepository(session)
    conv = await repo.create(user.id, req.title)
    return ConversationResponse(
        id=str(conv.id),
        title=conv.title,
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
    )
