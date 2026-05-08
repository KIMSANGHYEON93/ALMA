"""Web Push notification service"""

import json
import logging
import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from alma.config import settings
from alma.models.models import PushSubscription

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def subscribe(self, user_id: uuid.UUID, subscription: dict) -> None:
        """Push 구독 저장"""
        endpoint = subscription.get("endpoint", "")
        # 중복 체크
        existing = await self.session.execute(
            select(PushSubscription).where(
                PushSubscription.user_id == user_id,
                PushSubscription.endpoint == endpoint,
            )
        )
        if existing.scalar_one_or_none():
            return  # 이미 구독됨

        sub = PushSubscription(
            user_id=user_id,
            endpoint=endpoint,
            keys=subscription.get("keys", {}),
        )
        self.session.add(sub)
        await self.session.commit()

    async def unsubscribe(self, user_id: uuid.UUID, endpoint: str) -> None:
        """Push 구독 해제"""
        await self.session.execute(
            delete(PushSubscription).where(
                PushSubscription.user_id == user_id,
                PushSubscription.endpoint == endpoint,
            )
        )
        await self.session.commit()

    async def send_notification(
        self, user_id: uuid.UUID, title: str, body: str, url: str = "/habits"
    ) -> int:
        """사용자의 모든 구독에 Push 전송. 전송 성공 수 반환."""
        if not settings.vapid_private_key or not settings.vapid_public_key:
            return 0

        result = await self.session.execute(
            select(PushSubscription).where(PushSubscription.user_id == user_id)
        )
        subscriptions = result.scalars().all()
        if not subscriptions:
            return 0

        sent = 0
        for sub in subscriptions:
            try:
                from pywebpush import webpush

                subscription_info = {
                    "endpoint": sub.endpoint,
                    "keys": sub.keys,
                }
                payload = json.dumps(
                    {
                        "title": title,
                        "body": body,
                        "url": url,
                        "icon": "/icon-192.png",
                    }
                )
                webpush(
                    subscription_info=subscription_info,
                    data=payload,
                    vapid_private_key=settings.vapid_private_key,
                    vapid_claims={"sub": settings.vapid_email},
                )
                sent += 1
            except Exception as e:
                logger.warning("Push failed for endpoint %s: %s", sub.endpoint[:50], e)
                # 구독이 만료된 경우 삭제
                if "410" in str(e) or "404" in str(e):
                    await self.session.delete(sub)
                    await self.session.commit()

        return sent
