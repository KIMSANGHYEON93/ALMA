import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.notification.service import NotificationService
from alma.models.models import PushSubscription


@pytest.mark.asyncio
async def test_subscribe(db_session: AsyncSession, test_user):
    service = NotificationService(db_session)
    sub = {
        "endpoint": "https://push.example.com/abc123",
        "keys": {"p256dh": "key1", "auth": "key2"},
    }
    await service.subscribe(test_user.id, sub)

    # 중복 구독은 무시
    await service.subscribe(test_user.id, sub)

    result = await db_session.execute(
        select(PushSubscription).where(PushSubscription.user_id == test_user.id)
    )
    subs = result.scalars().all()
    assert len(subs) == 1
    assert subs[0].endpoint == "https://push.example.com/abc123"


@pytest.mark.asyncio
async def test_unsubscribe(db_session: AsyncSession, test_user):
    service = NotificationService(db_session)
    sub = {
        "endpoint": "https://push.example.com/xyz",
        "keys": {"p256dh": "k1", "auth": "k2"},
    }
    await service.subscribe(test_user.id, sub)
    await service.unsubscribe(test_user.id, "https://push.example.com/xyz")

    result = await db_session.execute(
        select(PushSubscription).where(PushSubscription.user_id == test_user.id)
    )
    assert len(result.scalars().all()) == 0


@pytest.mark.asyncio
async def test_send_no_vapid(db_session: AsyncSession, test_user):
    """VAPID 키 없으면 0 반환"""
    service = NotificationService(db_session)
    sent = await service.send_notification(test_user.id, "Test", "Body")
    assert sent == 0
