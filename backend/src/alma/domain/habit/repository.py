# backend/src/alma/domain/habit/repository.py
import uuid
from datetime import date

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from alma.models.models import Habit, HabitLog


class HabitRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        title: str,
        frequency_type: str,
        frequency_value: dict,
        start_date: date,
        description: str | None = None,
        target_value: float | None = None,
        target_unit: str | None = None,
        goal_id: uuid.UUID | None = None,
        sort_order: int = 0,
    ) -> Habit:
        habit = Habit(
            user_id=user_id,
            title=title,
            frequency_type=frequency_type,
            frequency_value=frequency_value,
            start_date=start_date,
            description=description,
            target_value=target_value,
            target_unit=target_unit,
            goal_id=goal_id,
            sort_order=sort_order,
        )
        self.session.add(habit)
        await self.session.commit()
        await self.session.refresh(habit)
        return habit

    async def get(self, habit_id: uuid.UUID) -> Habit | None:
        result = await self.session.execute(select(Habit).where(Habit.id == habit_id))
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: uuid.UUID, status: str | None = None) -> list[Habit]:
        query = select(Habit).where(Habit.user_id == user_id)
        if status:
            query = query.where(Habit.status == status)
        query = query.order_by(Habit.sort_order, desc(Habit.updated_at))
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def update(self, habit: Habit) -> Habit:
        await self.session.commit()
        await self.session.refresh(habit)
        return habit

    async def delete(self, habit_id: uuid.UUID) -> None:
        habit = await self.get(habit_id)
        if habit:
            await self.session.delete(habit)
            await self.session.commit()


class HabitLogRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def upsert(
        self,
        habit_id: uuid.UUID,
        user_id: uuid.UUID,
        log_date: date,
        completed: bool,
        source: str = "ui",
        value: float | None = None,
        note: str | None = None,
    ) -> HabitLog:
        existing = await self.get_by_date(habit_id, log_date)
        if existing:
            existing.completed = completed
            existing.value = value
            existing.note = note
            existing.source = source
            await self.session.commit()
            await self.session.refresh(existing)
            return existing
        log = HabitLog(
            habit_id=habit_id,
            user_id=user_id,
            log_date=log_date,
            completed=completed,
            value=value,
            note=note,
            source=source,
        )
        self.session.add(log)
        await self.session.commit()
        await self.session.refresh(log)
        return log

    async def get_by_date(self, habit_id: uuid.UUID, log_date: date) -> HabitLog | None:
        result = await self.session.execute(
            select(HabitLog).where(HabitLog.habit_id == habit_id, HabitLog.log_date == log_date)
        )
        return result.scalar_one_or_none()

    async def list_by_habit(self, habit_id: uuid.UUID, start: date, end: date) -> list[HabitLog]:
        result = await self.session.execute(
            select(HabitLog)
            .where(
                HabitLog.habit_id == habit_id,
                HabitLog.log_date >= start,
                HabitLog.log_date <= end,
            )
            .order_by(desc(HabitLog.log_date))
        )
        return list(result.scalars().all())

    async def list_by_user_date(self, user_id: uuid.UUID, log_date: date) -> list[HabitLog]:
        result = await self.session.execute(
            select(HabitLog).where(HabitLog.user_id == user_id, HabitLog.log_date == log_date)
        )
        return list(result.scalars().all())

    async def get_completed_dates(self, habit_id: uuid.UUID, start: date, end: date) -> set[date]:
        result = await self.session.execute(
            select(HabitLog.log_date).where(
                HabitLog.habit_id == habit_id,
                HabitLog.completed.is_(True),
                HabitLog.log_date >= start,
                HabitLog.log_date <= end,
            )
        )
        return {row[0] for row in result.all()}

    async def get_completed_dates_by_user(
        self, user_id: uuid.UUID, start: date, end: date
    ) -> dict[date, set[uuid.UUID]]:
        """사용자의 날짜별 완료된 습관 ID set 반환"""
        result = await self.session.execute(
            select(HabitLog.log_date, HabitLog.habit_id).where(
                HabitLog.user_id == user_id,
                HabitLog.completed.is_(True),
                HabitLog.log_date >= start,
                HabitLog.log_date <= end,
            )
        )
        data: dict[date, set[uuid.UUID]] = {}
        for row in result.all():
            data.setdefault(row[0], set()).add(row[1])
        return data

    async def get_heatmap_data(
        self, user_id: uuid.UUID, year: int
    ) -> dict[str, int]:
        """연간 날짜별 완료 습관 수"""
        from sqlalchemy import func as sa_func
        year_start = date(year, 1, 1)
        year_end = date(year, 12, 31)
        result = await self.session.execute(
            select(HabitLog.log_date, sa_func.count()).where(
                HabitLog.user_id == user_id,
                HabitLog.completed.is_(True),
                HabitLog.log_date >= year_start,
                HabitLog.log_date <= year_end,
            ).group_by(HabitLog.log_date)
        )
        return {row[0].isoformat(): row[1] for row in result.all()}
