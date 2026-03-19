import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.dependencies import get_current_user
from alma.database import get_session
from alma.models.models import User
from alma.domain.chat.repository import ConversationRepository

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


class ConversationResponse(BaseModel):
    id: str
    title: str | None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class CreateConversationRequest(BaseModel):
    title: str | None = None


class UpdateConversationRequest(BaseModel):
    title: str = Field(min_length=1)


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


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: str,
    req: UpdateConversationRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = ConversationRepository(session)
    conv = await repo.get(uuid.UUID(conversation_id))
    if not conv or conv.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv.title = req.title
    await session.commit()
    await session.refresh(conv)
    return ConversationResponse(
        id=str(conv.id),
        title=conv.title,
        created_at=conv.created_at.isoformat(),
        updated_at=conv.updated_at.isoformat(),
    )


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = ConversationRepository(session)
    conv = await repo.get(uuid.UUID(conversation_id))
    if not conv or conv.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await session.delete(conv)
    await session.commit()
