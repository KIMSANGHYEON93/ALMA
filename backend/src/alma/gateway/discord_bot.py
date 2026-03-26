"""Discord Bot — webhook-based message handler for ALMA"""

import logging

import httpx
from fastapi import APIRouter, Request
from sqlalchemy import select, text

from alma.config import settings
from alma.database import async_session
from alma.gateway.models import UnifiedMessage
from alma.gateway.service import ChannelService
from alma.models.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/discord", tags=["discord"])

DISCORD_API = "https://discord.com/api/v10"


async def _send_discord(channel_id: str, content: str) -> None:
    """Discord channel에 메시지 전송"""
    if not settings.discord_bot_token:
        return
    url = f"{DISCORD_API}/channels/{channel_id}/messages"
    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.post(
            url,
            json={"content": content},
            headers={
                "Authorization": f"Bot {settings.discord_bot_token}",
            },
        )


async def _find_user_by_discord_id(session, discord_id: str) -> User | None:
    """preferences.discord_id로 사용자 조회"""
    result = await session.execute(
        text("SELECT id FROM users WHERE preferences->>'discord_id' = :did"),
        {"did": discord_id},
    )
    row = result.first()
    if row:
        user_result = await session.execute(select(User).where(User.id == row[0]))
        return user_result.scalar_one_or_none()
    return None


@router.post("/webhook")
async def discord_webhook(request: Request):
    """Discord Bot webhook 핸들러

    Discord Interactions Endpoint를 사용하거나,
    외부 봇이 메시지를 이 엔드포인트로 포워딩하는 방식.

    Expected body:
    {
        "type": "message",
        "channel_id": "123456",
        "author_id": "789012",
        "content": "Hello ALMA"
    }
    """
    if not settings.discord_bot_token:
        return {"ok": False, "error": "Discord not configured"}

    body = await request.json()
    msg_type = body.get("type", "message")

    # Discord Interaction verification (ping)
    if msg_type == "ping" or body.get("type") == 1:
        return {"type": 1}  # PONG

    channel_id = body.get("channel_id")
    author_id = body.get("author_id")
    content = body.get("content", "")

    if not channel_id or not author_id or not content:
        return {"ok": True}

    # 허용된 길드 확인
    guild_id = body.get("guild_id")
    if settings.discord_allowed_guilds and guild_id:
        allowed = [g.strip() for g in settings.discord_allowed_guilds.split(",") if g.strip()]
        if allowed and guild_id not in allowed:
            await _send_discord(channel_id, "이 서버에서는 ALMA를 사용할 수 없습니다.")
            return {"ok": True}

    # 명령어 처리
    if content.startswith("!help") or content.startswith("/alma help"):
        await _send_discord(
            channel_id,
            (
                "**ALMA 명령어**\n"
                "- 일반 메시지: AI 대화\n"
                "- `!id`: 내 Discord ID 확인\n"
                "- `!help`: 도움말"
            ),
        )
        return {"ok": True}

    if content.startswith("!id"):
        await _send_discord(
            channel_id,
            f"당신의 Discord ID: `{author_id}`\n웹 설정에서 이 ID를 등록하세요.",
        )
        return {"ok": True}

    # 사용자 매핑
    async with async_session() as session:
        user = await _find_user_by_discord_id(session, author_id)
        if not user:
            await _send_discord(
                channel_id,
                (
                    f"계정이 연결되지 않았습니다.\n"
                    f"웹 설정에서 Discord ID `{author_id}`를 등록해주세요."
                ),
            )
            return {"ok": True}

        # 메시지 처리
        try:
            channel_service = ChannelService(session)
            msg = UnifiedMessage(
                channel="discord",
                user_id=str(user.id),
                content=content,
                metadata={"channel_id": channel_id, "guild_id": guild_id},
            )
            result = await channel_service.process_message(msg)

            # Discord 2000자 제한
            response_text = result.content
            if len(response_text) > 1900:
                response_text = response_text[:1900] + "\n...(truncated)"

            await _send_discord(channel_id, response_text)
        except Exception:
            logger.exception("Discord message processing failed")
            await _send_discord(channel_id, "처리 중 오류가 발생했습니다.")

    return {"ok": True}
