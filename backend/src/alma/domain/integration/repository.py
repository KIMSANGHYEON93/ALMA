import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from alma.models.models import ActionLog


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
