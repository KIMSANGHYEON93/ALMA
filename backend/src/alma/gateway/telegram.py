import logging

import httpx
from fastapi import APIRouter, Request
from sqlalchemy import select

from alma.config import settings
from alma.database import async_session
from alma.gateway.models import UnifiedMessage
from alma.gateway.service import ChannelService
from alma.models.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/telegram", tags=["telegram"])

TELEGRAM_API = "https://api.telegram.org/bot{token}"


async def _send_telegram(chat_id: int, text: str) -> None:
    """Telegram sendMessage API 호출"""
    if not settings.telegram_bot_token:
        return
    url = f"{TELEGRAM_API.format(token=settings.telegram_bot_token)}/sendMessage"
    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.post(
            url,
            json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "Markdown",
            },
        )


async def _find_user_by_telegram_id(
    session,
    telegram_id: int,
) -> User | None:
    """preferences.telegram_id로 사용자 조회"""
    from sqlalchemy import text

    result = await session.execute(
        text("SELECT id FROM users WHERE preferences->>'telegram_id' = :tid"),
        {"tid": str(telegram_id)},
    )
    row = result.first()
    if row:
        user_result = await session.execute(select(User).where(User.id == row[0]))
        return user_result.scalar_one_or_none()
    return None


@router.post("/webhook")
async def telegram_webhook(request: Request):
    """Telegram Bot webhook 핸들러"""
    if not settings.telegram_bot_token:
        return {"ok": False, "error": "Telegram not configured"}

    body = await request.json()
    message = body.get("message")
    if not message or "text" not in message:
        return {"ok": True}

    chat_id = message["chat"]["id"]
    telegram_user_id = message["from"]["id"]
    text = message["text"]

    # 허용된 사용자 확인
    allowed = settings.telegram_allowed_users
    if allowed:
        allowed_ids = [int(x.strip()) for x in allowed.split(",") if x.strip()]
        if telegram_user_id not in allowed_ids:
            await _send_telegram(chat_id, "이 봇을 사용할 권한이 없습니다.")
            return {"ok": True}

    # /start 명령 처리 (계정 연결)
    if text.startswith("/start"):
        await _send_telegram(
            chat_id,
            (
                "ALMA입니다!\n\n"
                "계정을 연결하려면 웹 설정에서 Telegram ID를 등록해주세요.\n"
                f"당신의 Telegram ID: `{telegram_user_id}`"
            ),
        )
        return {"ok": True}

    # 사용자 매핑
    async with async_session() as session:
        user = await _find_user_by_telegram_id(session, telegram_user_id)
        if not user:
            await _send_telegram(
                chat_id,
                (
                    "계정이 연결되지 않았습니다.\n"
                    f"웹 설정에서 Telegram ID `{telegram_user_id}`를 등록해주세요."
                ),
            )
            return {"ok": True}

        # 메시지 처리
        try:
            channel_service = ChannelService(session)
            msg = UnifiedMessage(
                channel="telegram",
                user_id=str(user.id),
                content=text,
            )
            result = await channel_service.process_message(msg)
            await _send_telegram(chat_id, result.content)
        except Exception:
            logger.exception("Telegram message processing failed")
            await _send_telegram(chat_id, "처리 중 오류가 발생했습니다.")

    return {"ok": True}
