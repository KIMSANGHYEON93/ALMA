import uuid
from datetime import datetime

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from alma.models.models import Goal, GoalConversationLink, Milestone


class GoalRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        title: str,
        description: str | None = None,
        category: str = "other",
        target_date=None,
    ) -> Goal:
        goal = Goal(
            user_id=user_id,
            title=title,
            description=description,
            category=category,
            target_date=target_date,
        )
        self.session.add(goal)
        await self.session.commit()
        await self.session.refresh(goal)
        return goal

    async def get(self, goal_id: uuid.UUID) -> Goal | None:
        result = await self.session.execute(select(Goal).where(Goal.id == goal_id))
        return result.scalar_one_or_none()

    async def list_by_user(
        self,
        user_id: uuid.UUID,
        status: str | None = None,
        category: str | None = None,
    ) -> list[Goal]:
        query = select(Goal).where(Goal.user_id == user_id)
        if status:
            query = query.where(Goal.status == status)
        if category:
            query = query.where(Goal.category == category)
        query = query.order_by(desc(Goal.updated_at))
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def update(self, goal: Goal) -> Goal:
        await self.session.commit()
        await self.session.refresh(goal)
        return goal

    async def delete(self, goal_id: uuid.UUID) -> None:
        goal = await self.get(goal_id)
        if goal:
            await self.session.delete(goal)
            await self.session.commit()

    async def get_summary(self, user_id: uuid.UUID) -> dict:
        result = await self.session.execute(
            select(
                func.count(Goal.id).label("total"),
                func.count(Goal.id).filter(Goal.status == "active").label("active"),
                func.avg(Goal.progress).label("avg_progress"),
            ).where(Goal.user_id == user_id)
        )
        row = result.one()
        return {
            "total_goals": row.total,
            "active_goals": row.active,
            "average_progress": int(row.avg_progress or 0),
        }


class MilestoneRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        goal_id: uuid.UUID,
        title: str,
        description: str | None = None,
        sort_order: int = 0,
    ) -> Milestone:
        milestone = Milestone(
            goal_id=goal_id,
            title=title,
            description=description,
            sort_order=sort_order,
        )
        self.session.add(milestone)
        await self.session.commit()
        await self.session.refresh(milestone)
        return milestone

    async def get(self, milestone_id: uuid.UUID) -> Milestone | None:
        result = await self.session.execute(select(Milestone).where(Milestone.id == milestone_id))
        return result.scalar_one_or_none()

    async def list_by_goal(self, goal_id: uuid.UUID) -> list[Milestone]:
        result = await self.session.execute(
            select(Milestone).where(Milestone.goal_id == goal_id).order_by(Milestone.sort_order)
        )
        return list(result.scalars().all())

    async def update(self, milestone: Milestone) -> Milestone:
        await self.session.commit()
        await self.session.refresh(milestone)
        return milestone

    async def complete(self, milestone: Milestone) -> Milestone:
        milestone.status = "completed"
        milestone.completed_at = datetime.utcnow()
        return await self.update(milestone)

    async def delete(self, milestone_id: uuid.UUID) -> None:
        milestone = await self.get(milestone_id)
        if milestone:
            await self.session.delete(milestone)
            await self.session.commit()


class GoalConversationLinkRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def link(
        self,
        goal_id: uuid.UUID,
        conversation_id: uuid.UUID,
        relevance_note: str | None = None,
    ) -> GoalConversationLink:
        link = GoalConversationLink(
            goal_id=goal_id,
            conversation_id=conversation_id,
            relevance_note=relevance_note,
        )
        self.session.add(link)
        await self.session.commit()
        return link
