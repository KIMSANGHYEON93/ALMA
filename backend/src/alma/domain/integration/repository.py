import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alma.models.models import ActionLog, Integration


class ActionLogRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        service: str,
        action: str,
        params: dict,
        result: dict | None = None,
        success: bool = True,
    ) -> ActionLog:
        log = ActionLog(
            user_id=user_id,
            service=service,
            action=action,
            params=params,
            result=result,
            success=success,
        )
        self.session.add(log)
        await self.session.commit()
        return log


class IntegrationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_or_update(
        self,
        user_id: uuid.UUID,
        provider: str,
        access_token: str,
        refresh_token: str | None = None,
        token_expiry: datetime | None = None,
        scopes: str | None = None,
        status: str = "active",
    ) -> Integration:
        result = await self.session.execute(
            select(Integration).where(
                Integration.user_id == user_id,
                Integration.provider == provider,
            )
        )
        integration = result.scalar_one_or_none()
        if integration:
            integration.access_token = access_token
            integration.refresh_token = refresh_token or integration.refresh_token
            integration.token_expiry = token_expiry
            integration.scopes = scopes or integration.scopes
            integration.status = status
        else:
            integration = Integration(
                user_id=user_id,
                provider=provider,
                access_token=access_token,
                refresh_token=refresh_token,
                token_expiry=token_expiry,
                scopes=scopes,
                status=status,
            )
            self.session.add(integration)
        await self.session.commit()
        await self.session.refresh(integration)
        return integration

    async def get_active(self, user_id: uuid.UUID, provider: str) -> Integration | None:
        result = await self.session.execute(
            select(Integration).where(
                Integration.user_id == user_id,
                Integration.provider == provider,
                Integration.status == "active",
            )
        )
        return result.scalar_one_or_none()

    async def get(self, integration_id) -> Integration | None:
        result = await self.session.execute(
            select(Integration).where(Integration.id == uuid.UUID(str(integration_id)))
        )
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: uuid.UUID) -> list[Integration]:
        result = await self.session.execute(
            select(Integration).where(Integration.user_id == user_id)
        )
        return list(result.scalars().all())

    async def update_status(self, integration: Integration, status: str) -> Integration:
        integration.status = status
        await self.session.commit()
        await self.session.refresh(integration)
        return integration

    async def update_tokens(
        self,
        integration: Integration,
        access_token: str,
        token_expiry: datetime | None = None,
        status: str = "active",
    ) -> Integration:
        """OAuth 토큰 갱신 후 DB에 명시적으로 영속화."""
        integration.access_token = access_token
        if token_expiry is not None:
            integration.token_expiry = token_expiry
        integration.status = status
        await self.session.commit()
        await self.session.refresh(integration)
        return integration

    async def delete(self, integration_id: uuid.UUID) -> None:
        integration = await self.get(integration_id)
        if integration:
            await self.session.delete(integration)
            await self.session.commit()
