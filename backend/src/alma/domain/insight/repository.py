import uuid
from datetime import date

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from alma.models.models import Conversation, Insight, Message, Retrospective


class RetrospectiveRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        period_type: str,
        period_start: date,
        period_end: date,
        summary: str,
        highlights: list,
        challenges: list,
        goals_progress: list,
        conversation_count: int,
        message_count: int,
    ) -> Retrospective:
        retro = Retrospective(
            user_id=user_id,
            period_type=period_type,
            period_start=period_start,
            period_end=period_end,
            summary=summary,
            highlights=highlights,
            challenges=challenges,
            goals_progress=goals_progress,
            conversation_count=conversation_count,
            message_count=message_count,
        )
        self.session.add(retro)
        await self.session.commit()
        await self.session.refresh(retro)
        return retro

    async def get(self, retro_id: uuid.UUID) -> Retrospective | None:
        result = await self.session.execute(
            select(Retrospective).where(Retrospective.id == retro_id)
        )
        return result.scalar_one_or_none()

    async def get_by_period(
        self, user_id: uuid.UUID, period_type: str, period_start: date
    ) -> Retrospective | None:
        result = await self.session.execute(
            select(Retrospective).where(
                Retrospective.user_id == user_id,
                Retrospective.period_type == period_type,
                Retrospective.period_start == period_start,
            )
        )
        return result.scalar_one_or_none()

    async def get_latest(self, user_id: uuid.UUID) -> Retrospective | None:
        result = await self.session.execute(
            select(Retrospective)
            .where(Retrospective.user_id == user_id)
            .order_by(desc(Retrospective.period_end))
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def list_by_user(
        self, user_id: uuid.UUID, limit: int = 10
    ) -> list[Retrospective]:
        result = await self.session.execute(
            select(Retrospective)
            .where(Retrospective.user_id == user_id)
            .order_by(desc(Retrospective.period_end))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count_conversations(
        self, user_id: uuid.UUID, start: date, end: date
    ) -> int:
        result = await self.session.execute(
            select(func.count(Conversation.id)).where(
                Conversation.user_id == user_id,
                Conversation.updated_at >= start,
                Conversation.updated_at <= end,
            )
        )
        return result.scalar() or 0

    async def count_messages(
        self, user_id: uuid.UUID, start: date, end: date
    ) -> int:
        result = await self.session.execute(
            select(func.count(Message.id)).where(
                Message.conversation_id.in_(
                    select(Conversation.id).where(
                        Conversation.user_id == user_id,
                        Conversation.updated_at >= start,
                        Conversation.updated_at <= end,
                    )
                )
            )
        )
        return result.scalar() or 0

    async def get_period_messages(
        self, user_id: uuid.UUID, start: date, end: date, limit: int = 50
    ) -> list[Message]:
        conv_ids = await self.session.execute(
            select(Conversation.id).where(
                Conversation.user_id == user_id,
                Conversation.updated_at >= start,
                Conversation.updated_at <= end,
            )
        )
        ids = [r for r in conv_ids.scalars().all()]
        if not ids:
            return []
        result = await self.session.execute(
            select(Message)
            .where(Message.conversation_id.in_(ids))
            .order_by(desc(Message.created_at))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_streak_days(self, user_id: uuid.UUID) -> int:
        result = await self.session.execute(
            select(func.date_trunc("day", Message.created_at).label("d"))
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(Conversation.user_id == user_id, Message.role == "user")
            .group_by("d")
            .order_by(desc("d"))
        )
        days = [r[0].date() for r in result.all()]
        if not days:
            return 0
        from datetime import timedelta

        streak = 1
        for i in range(1, len(days)):
            if days[i - 1] - days[i] == timedelta(days=1):
                streak += 1
            else:
                break
        return streak


class InsightRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        category: str,
        title: str,
        content: str,
        data: dict | None = None,
        source_period: str | None = None,
        retrospective_id: uuid.UUID | None = None,
    ) -> Insight:
        insight = Insight(
            user_id=user_id,
            category=category,
            title=title,
            content=content,
            data=data or {},
            source_period=source_period,
            retrospective_id=retrospective_id,
        )
        self.session.add(insight)
        await self.session.commit()
        await self.session.refresh(insight)
        return insight

    async def list_recent(
        self, user_id: uuid.UUID, limit: int = 5
    ) -> list[Insight]:
        result = await self.session.execute(
            select(Insight)
            .where(Insight.user_id == user_id)
            .order_by(desc(Insight.created_at))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def list_by_retrospective(
        self, retrospective_id: uuid.UUID
    ) -> list[Insight]:
        result = await self.session.execute(
            select(Insight)
            .where(Insight.retrospective_id == retrospective_id)
            .order_by(Insight.created_at)
        )
        return list(result.scalars().all())
