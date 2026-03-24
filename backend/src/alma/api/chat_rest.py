from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.dependencies import get_current_user
from alma.database import get_session
from alma.gateway.models import UnifiedMessage
from alma.gateway.service import ChannelService
from alma.models.models import User

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessageRequest(BaseModel):
    content: str = Field(min_length=1)
    conversation_id: str | None = None


class ChatMessageResponse(BaseModel):
    response: str
    conversation_id: str


@router.post("/message", response_model=ChatMessageResponse)
async def chat_message(
    req: ChatMessageRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """REST 기반 채팅 (CLI, Telegram 등 non-WebSocket 채널용)"""
    channel_service = ChannelService(session)
    msg = UnifiedMessage(
        channel="rest",
        user_id=str(user.id),
        content=req.content,
        conversation_id=req.conversation_id,
    )
    result = await channel_service.process_message(msg)
    return ChatMessageResponse(
        response=result.content,
        conversation_id=result.conversation_id,
    )
