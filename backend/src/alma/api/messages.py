import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.dependencies import get_current_user
from alma.database import get_session
from alma.domain.chat.repository import MessageRepository
from alma.models.models import Conversation, User

router = APIRouter(prefix="/api/conversations", tags=["messages"])


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: str


class MessagesPageResponse(BaseModel):
    messages: list[MessageResponse]
    has_more: bool


@router.get("/{conversation_id}/messages", response_model=MessagesPageResponse)
async def get_messages(
    conversation_id: uuid.UUID,
    limit: int = Query(default=20, le=100),
    before: uuid.UUID | None = Query(default=None),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Conversation not found")

    repo = MessageRepository(session)
    messages, has_more = await repo.get_messages_paginated(conversation_id, limit, before)
    return MessagesPageResponse(
        messages=[
            MessageResponse(
                id=str(m.id),
                role=m.role,
                content=m.content,
                created_at=m.created_at.isoformat(),
            )
            for m in messages
        ],
        has_more=has_more,
    )
