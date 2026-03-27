from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.dependencies import get_current_user
from alma.config import settings
from alma.database import get_session
from alma.domain.notification.service import NotificationService
from alma.models.models import User

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class SubscriptionRequest(BaseModel):
    subscription: dict


class UnsubscribeRequest(BaseModel):
    endpoint: str


@router.get("/vapid-key")
async def get_vapid_key():
    """프론트엔드 Push 구독에 필요한 VAPID public key"""
    return {"publicKey": settings.vapid_public_key}


@router.post("/subscribe")
async def subscribe(
    req: SubscriptionRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = NotificationService(session)
    await service.subscribe(user.id, req.subscription)
    return {"ok": True}


@router.post("/unsubscribe")
async def unsubscribe(
    req: UnsubscribeRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = NotificationService(session)
    await service.unsubscribe(user.id, req.endpoint)
    return {"ok": True}


@router.post("/test")
async def test_notification(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """테스트 알림 전송"""
    service = NotificationService(session)
    sent = await service.send_notification(
        user.id, "ALMA 테스트", "Push 알림이 정상 동작합니다!"
    )
    return {"sent": sent}
