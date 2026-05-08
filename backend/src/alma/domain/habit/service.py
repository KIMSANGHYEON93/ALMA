# backend/src/alma/domain/habit/service.py
import uuid
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.habit.repository import HabitLogRepository, HabitRepository
from alma.models.models import Habit, HabitLog


class HabitService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.habit_repo = HabitRepository(session)
        self.log_repo = HabitLogRepository(session)

    async def create_habit(
        self,
        user_id: uuid.UUID,
        title: str,
        frequency_type: str = "daily",
        frequency_value: dict | None = None,
        start_date: date | None = None,
        **kwargs,
    ) -> Habit:
        habit = await self.habit_repo.create(
            user_id=user_id,
            title=title,
            frequency_type=frequency_type,
            frequency_value=frequency_value or {},
            start_date=start_date or date.today(),
            **kwargs,
        )
        try:
            from alma.core.events.helpers import emit

            await emit(
                "habit.created",
                "habit",
                {
                    "habit_id": str(habit.id),
                    "title": habit.title,
                    "frequency_type": habit.frequency_type,
                },
                user_id=str(user_id),
                aggregate_id=str(habit.id),
            )
        except Exception:
            pass
        return habit

    async def get_habit(self, habit_id: uuid.UUID, user_id: uuid.UUID) -> Habit | None:
        habit = await self.habit_repo.get(habit_id)
        if habit and habit.user_id == user_id:
            return habit
        return None

    async def list_habits(self, user_id: uuid.UUID, status: str | None = None) -> list[Habit]:
        return await self.habit_repo.list_by_user(user_id, status)

    async def update_habit(self, habit: Habit, **kwargs) -> Habit:
        old_status = habit.status
        for key, value in kwargs.items():
            if hasattr(habit, key):
                setattr(habit, key, value)
        # paused → active: reset start_date
        new_status = kwargs.get("status")
        if old_status == "paused" and new_status == "active":
            habit.start_date = date.today()
        return await self.habit_repo.update(habit)

    async def delete_habit(self, habit_id: uuid.UUID) -> None:
        await self.habit_repo.delete(habit_id)
        try:
            from alma.core.events.helpers import emit

            await emit("habit.deleted", "habit", {"habit_id": str(habit_id)})
        except Exception:
            pass

    async def checkin(
        self,
        habit_id: uuid.UUID,
        user_id: uuid.UUID,
        log_date: date,
        completed: bool,
        source: str = "ui",
        value: float | None = None,
        note: str | None = None,
    ) -> HabitLog:
        habit = await self.habit_repo.get(habit_id)
        if not habit or habit.user_id != user_id:
            raise PermissionError("Not the owner of this habit")
        result = await self.log_repo.upsert(
            habit_id=habit_id,
            user_id=user_id,
            log_date=log_date,
            completed=completed,
            source=source,
            value=value,
            note=note,
        )
        try:
            from alma.core.events.helpers import emit

            await emit(
                "habit.checkin_completed",
                "habit",
                {"habit_id": str(habit_id), "completed": completed, "source": source},
                user_id=str(user_id),
                aggregate_id=str(habit_id),
            )
        except Exception:
            pass
        return result

    async def get_logs(
        self,
        habit_id: uuid.UUID,
        start: date | None = None,
        end: date | None = None,
    ) -> list[HabitLog]:
        end = end or date.today()
        start = start or (end - timedelta(days=30))
        return await self.log_repo.list_by_habit(habit_id, start, end)

    @staticmethod
    def is_scheduled(habit: Habit, check_date: date) -> bool:
        ft = habit.frequency_type
        fv = habit.frequency_value or {}

        if ft == "daily":
            return True
        elif ft == "specific_days":
            return check_date.weekday() in fv.get("days", [])
        elif ft == "times_per_week":
            return True  # weekly count, always "schedulable"
        elif ft == "every_n_days":
            interval = fv.get("interval", 1)
            delta = (check_date - habit.start_date).days
            return delta >= 0 and delta % interval == 0
        return False

    async def get_streak(self, habit: Habit, as_of: date) -> int:
        if habit.frequency_type == "times_per_week":
            return await self._streak_times_per_week(habit, as_of)
        return await self._streak_day_based(habit, as_of)

    async def _streak_day_based(self, habit: Habit, as_of: date) -> int:
        # Fetch completed dates for last 180 days
        earliest = max(as_of - timedelta(days=180), habit.start_date)
        completed_dates = await self.log_repo.get_completed_dates(habit.id, earliest, as_of)

        streak = 0
        current = as_of
        while current >= earliest:
            if self.is_scheduled(habit, current):
                if current in completed_dates:
                    streak += 1
                else:
                    break
            # Not scheduled = skip (streak preserved)
            current -= timedelta(days=1)
        return streak

    async def _streak_times_per_week(self, habit: Habit, as_of: date) -> int:
        times_needed = (habit.frequency_value or {}).get("times", 1)
        # ISO week: Monday = start
        streak = 0

        # Start from current week's Monday
        current_monday = as_of - timedelta(days=as_of.weekday())
        check_monday = current_monday

        # Check current week first (only if already met target)
        start_180 = as_of - timedelta(days=180)
        completed_dates = await self.log_repo.get_completed_dates(habit.id, start_180, as_of)

        # Current week: count only if target already met
        current_week_count = sum(1 for d in completed_dates if current_monday <= d <= as_of)
        if current_week_count >= times_needed:
            streak += 1
            check_monday = current_monday - timedelta(days=7)
        else:
            # Current week not yet met, start from previous week
            check_monday = current_monday - timedelta(days=7)

        # Check previous weeks
        while check_monday >= start_180:
            week_end = check_monday + timedelta(days=6)
            week_count = sum(1 for d in completed_dates if check_monday <= d <= week_end)
            if week_count >= times_needed:
                streak += 1
                check_monday -= timedelta(days=7)
            else:
                break
        return streak

    async def find_by_title(self, user_id: uuid.UUID, query: str) -> list[Habit]:
        """활성 습관 중 title에 query가 포함된 습관 반환 (case-insensitive)"""
        habits = await self.list_habits(user_id, status="active")
        query_lower = query.lower()
        return [h for h in habits if query_lower in h.title.lower()]

    async def get_habits_context(self, user_id: uuid.UUID) -> str:
        """채팅 시스템 프롬프트에 주입할 오늘 습관 상태 텍스트"""
        summary = await self.get_today_summary(user_id)
        if summary["total"] == 0:
            return ""
        lines = [f"[오늘의 습관 ({summary['completed']}/{summary['total']} 완료)]"]
        for h in summary["habits"]:
            if not h["scheduled_today"]:
                continue
            icon = "✅" if h["completed"] else "⬜"
            text = f"- {icon} {h['title']}"
            if h["target_value"]:
                text += f" ({h['value'] or 0}/{h['target_value']}{h['target_unit'] or ''})"
            if h["streak"] > 0:
                text += f" 🔥{h['streak']}일"
            lines.append(text)
        return "\n".join(lines)

    async def get_today_summary(self, user_id: uuid.UUID) -> dict:
        today = date.today()
        habits = await self.habit_repo.list_by_user(user_id, status="active")
        today_logs = await self.log_repo.list_by_user_date(user_id, today)
        log_map = {log.habit_id: log for log in today_logs}

        habit_items = []
        completed_count = 0
        scheduled_count = 0

        for habit in habits:
            scheduled = self.is_scheduled(habit, today)
            log = log_map.get(habit.id)
            checked_in = log is not None
            is_completed = log.completed if log else False

            if scheduled:
                scheduled_count += 1
                if is_completed:
                    completed_count += 1

            streak = await self.get_streak(habit, today)

            habit_items.append(
                {
                    "id": str(habit.id),
                    "title": habit.title,
                    "frequency_type": habit.frequency_type,
                    "scheduled_today": scheduled,
                    "checked_in": checked_in,
                    "completed": is_completed,
                    "value": log.value if log else None,
                    "target_value": habit.target_value,
                    "target_unit": habit.target_unit,
                    "streak": streak,
                    "note": log.note if log else None,
                }
            )

        return {
            "date": today.isoformat(),
            "total": scheduled_count,
            "completed": completed_count,
            "habits": habit_items,
        }
