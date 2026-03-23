import uuid
from datetime import date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.integration.calendar import GoogleCalendarProvider
from alma.domain.integration.repository import IntegrationRepository
from alma.models.models import Habit

# weekday index → RRULE BYDAY
WEEKDAY_MAP = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]

# times_per_week → 균등 분배 요일
TIMES_TO_DAYS = {
    1: [0],
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 3, 4],
    6: [0, 1, 2, 3, 4, 5],
    7: [0, 1, 2, 3, 4, 5, 6],
}


class HabitCalendarSync:
    def __init__(self, session: AsyncSession, integration_repo: IntegrationRepository):
        self.session = session
        self.integration_repo = integration_repo

    async def sync_to_calendar(
        self,
        habit: Habit,
        user_id: uuid.UUID,
        event_time: str = "09:00",
        timezone: str = "Asia/Seoul",
    ) -> str | None:
        """습관을 Google Calendar 반복 이벤트로 생성. event_id 반환.
        캘린더 미연동 시 None 반환."""
        integration = await self.integration_repo.get_active(user_id, "google_calendar")
        if not integration:
            return None

        provider = GoogleCalendarProvider(integration, self.integration_repo)
        rrule = self.frequency_to_rrule(habit.frequency_type, habit.frequency_value or {})

        today_str = date.today().isoformat()
        start_dt = datetime.strptime(f"{today_str}T{event_time}", "%Y-%m-%dT%H:%M")
        end_dt = start_dt + timedelta(minutes=30)
        start = start_dt.strftime("%Y-%m-%dT%H:%M:%S")
        end = end_dt.strftime("%Y-%m-%dT%H:%M:%S")

        event = await provider.create_event(
            summary=f"[습관] {habit.title}",
            start=start,
            end=end,
            timezone=timezone,
            recurrence=[rrule],
            reminders={
                "useDefault": False,
                "overrides": [{"method": "popup", "minutes": 30}],
            },
        )

        habit.calendar_event_id = event.id
        await self.session.commit()
        await self.session.refresh(habit)
        return event.id

    async def remove_from_calendar(self, habit: Habit, user_id: uuid.UUID) -> None:
        """습관의 캘린더 이벤트 삭제."""
        if not habit.calendar_event_id:
            return

        integration = await self.integration_repo.get_active(user_id, "google_calendar")
        if integration:
            provider = GoogleCalendarProvider(integration, self.integration_repo)
            try:
                await provider.delete_event(habit.calendar_event_id)
            except Exception:
                pass  # 이벤트가 이미 삭제된 경우

        # Integration 유무와 관계없이 고아 참조 제거
        habit.calendar_event_id = None
        await self.session.commit()

    @staticmethod
    def frequency_to_rrule(frequency_type: str, frequency_value: dict) -> str:
        """frequency_type/value → Google Calendar RRULE 문자열 변환"""
        if frequency_type == "daily":
            return "RRULE:FREQ=DAILY"

        if frequency_type == "specific_days":
            days = frequency_value.get("days", [])
            byday = ",".join(WEEKDAY_MAP[d] for d in sorted(days))
            return f"RRULE:FREQ=WEEKLY;BYDAY={byday}"

        if frequency_type == "times_per_week":
            times = frequency_value.get("times", 1)
            day_indices = TIMES_TO_DAYS.get(times, [0])
            byday = ",".join(WEEKDAY_MAP[d] for d in day_indices)
            return f"RRULE:FREQ=WEEKLY;BYDAY={byday}"

        if frequency_type == "every_n_days":
            interval = frequency_value.get("interval", 1)
            return f"RRULE:FREQ=DAILY;INTERVAL={interval}"

        return "RRULE:FREQ=DAILY"
