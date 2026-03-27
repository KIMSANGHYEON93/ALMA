import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.growth.repository import (
    GoalConversationLinkRepository,
    GoalRepository,
    MilestoneRepository,
)
from alma.models.models import Goal, Milestone


class GoalService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.goal_repo = GoalRepository(session)
        self.milestone_repo = MilestoneRepository(session)
        self.link_repo = GoalConversationLinkRepository(session)

    @staticmethod
    def calculate_progress(milestones: list[Milestone]) -> int:
        if not milestones:
            return 0
        completed = sum(1 for m in milestones if m.status == "completed")
        return min(100, int(completed / len(milestones) * 100))

    async def create_goal(self, user_id: uuid.UUID, title: str, **kwargs) -> Goal:
        goal = await self.goal_repo.create(user_id, title, **kwargs)
        try:
            from alma.core.events.helpers import emit
            await emit(
                "goal.created", "growth",
                {"goal_id": str(goal.id), "title": goal.title},
                user_id=str(user_id), aggregate_id=str(goal.id),
            )
        except Exception:
            pass
        return goal

    async def get_goal(self, goal_id, user_id) -> Goal | None:
        goal = await self.goal_repo.get(uuid.UUID(str(goal_id)))
        if goal and goal.user_id == uuid.UUID(str(user_id)):
            return goal
        return None

    async def list_goals(
        self,
        user_id: uuid.UUID,
        status: str | None = None,
        category: str | None = None,
    ) -> list[Goal]:
        return await self.goal_repo.list_by_user(user_id, status, category)

    async def update_goal(self, goal: Goal, **kwargs) -> Goal:
        for key, value in kwargs.items():
            if hasattr(goal, key):
                setattr(goal, key, value)
        updated = await self.goal_repo.update(goal)
        try:
            from alma.core.events.helpers import emit
            await emit(
                "goal.updated", "growth",
                {"goal_id": str(goal.id), "changed": {k: v for k, v in kwargs.items() if v is not None}},
                user_id=str(goal.user_id), aggregate_id=str(goal.id),
            )
        except Exception:
            pass
        return updated

    async def delete_goal(self, goal_id: uuid.UUID) -> None:
        await self.goal_repo.delete(goal_id)
        try:
            from alma.core.events.helpers import emit
            await emit(
                "goal.deleted", "growth",
                {"goal_id": str(goal_id)},
            )
        except Exception:
            pass

    async def update_goal_status(self, goal: Goal, status: str) -> Goal:
        goal.status = status
        return await self.goal_repo.update(goal)

    async def add_milestone(self, goal_id: uuid.UUID, title: str, **kwargs) -> Milestone:
        return await self.milestone_repo.create(goal_id, title, **kwargs)

    async def complete_milestone(
        self, milestone: Milestone, goal: Goal
    ) -> tuple[Milestone, Goal, bool]:
        """Returns (milestone, goal, suggest_complete)"""
        milestone = await self.milestone_repo.complete(milestone)
        milestones = await self.milestone_repo.list_by_goal(goal.id)
        goal.progress = self.calculate_progress(milestones)
        goal = await self.goal_repo.update(goal)
        suggest_complete = goal.progress == 100
        return milestone, goal, suggest_complete

    async def delete_milestone(self, milestone_id: uuid.UUID, goal: Goal) -> Goal:
        await self.milestone_repo.delete(milestone_id)
        milestones = await self.milestone_repo.list_by_goal(goal.id)
        goal.progress = self.calculate_progress(milestones)
        return await self.goal_repo.update(goal)

    async def get_summary(self, user_id: uuid.UUID) -> dict:
        return await self.goal_repo.get_summary(user_id)

    async def get_active_goals_context(self, user_id, limit: int = 5) -> str:
        """ChatService용 활성 목표 컨텍스트 문자열"""
        goals = await self.goal_repo.list_by_user(
            uuid.UUID(str(user_id)), status="active"
        )
        if not goals:
            return ""
        goals = goals[:limit]
        lines = [f"- {g.title} ({g.progress}%, {g.category})" for g in goals]
        return "Active goals:\n" + "\n".join(lines)

    async def link_conversation(
        self,
        goal_id: uuid.UUID,
        conversation_id: uuid.UUID,
        relevance_note: str | None = None,
    ):
        return await self.link_repo.link(goal_id, conversation_id, relevance_note)
