# backend/src/alma/domain/habit/analytics.py
import uuid
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.habit.repository import HabitLogRepository, HabitRepository
from alma.domain.habit.service import HabitService
from alma.domain.insight.repository import InsightRepository
from alma.infrastructure.llm.base import ChatMessage, LLMProvider, LLMRequest


def _pearson(x: list[int], y: list[int]) -> float:
    n = len(x)
    if n < 2:
        return 0.0
    mean_x = sum(x) / n
    mean_y = sum(y) / n
    numerator = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
    var_x = sum((xi - mean_x) ** 2 for xi in x) / (n - 1)
    var_y = sum((yi - mean_y) ** 2 for yi in y) / (n - 1)
    std_x = var_x**0.5
    std_y = var_y**0.5
    if std_x == 0 or std_y == 0:
        return 0.0
    return numerator / ((n - 1) * std_x * std_y)


class HabitAnalyticsService:
    def __init__(self, session: AsyncSession, llm: LLMProvider | None = None):
        self.session = session
        self.habit_repo = HabitRepository(session)
        self.log_repo = HabitLogRepository(session)
        self.habit_service = HabitService(session)
        self.insight_repo = InsightRepository(session)
        self.llm = llm

    async def get_heatmap(self, user_id: uuid.UUID, year: int) -> dict:
        dates = await self.log_repo.get_heatmap_data(user_id, year)
        return {"dates": dates}

    async def get_trends(self, user_id: uuid.UUID, days: int = 30) -> dict:
        today = date.today()
        start = today - timedelta(days=days - 1)
        habits = await self.habit_repo.list_by_user(user_id, status="active")
        completed_logs = await self.log_repo.get_completed_dates_by_user(user_id, start, today)

        daily = []
        weekday_totals = [0] * 7
        weekday_completed = [0] * 7

        for i in range(days):
            d = start + timedelta(days=i)
            scheduled = [h for h in habits if HabitService.is_scheduled(h, d)]
            total = len(scheduled)
            completed = sum(1 for h in scheduled if h.id in completed_logs.get(d, set()))
            rate = round(completed / total * 100) if total > 0 else 0
            daily.append(
                {"date": d.isoformat(), "total": total, "completed": completed, "rate": rate}
            )

            weekday_totals[d.weekday()] += total
            weekday_completed[d.weekday()] += completed

        weekday = []
        day_names = ["월", "화", "수", "목", "금", "토", "일"]
        for i in range(7):
            rate = (
                round(weekday_completed[i] / weekday_totals[i] * 100)
                if weekday_totals[i] > 0
                else 0
            )
            weekday.append({"day": day_names[i], "rate": rate})

        return {"daily": daily, "weekday": weekday}

    async def get_completion(self, user_id: uuid.UUID, days: int = 30) -> dict:
        today = date.today()
        start = today - timedelta(days=days - 1)
        habits = await self.habit_repo.list_by_user(user_id, status="active")

        result_habits = []
        for habit in habits:
            completed_dates = await self.log_repo.get_completed_dates(habit.id, start, today)
            total_days = sum(
                1
                for i in range(days)
                if HabitService.is_scheduled(habit, start + timedelta(days=i))
            )
            completed_days = len(completed_dates)
            rate = round(completed_days / total_days * 100) if total_days > 0 else 0
            result_habits.append(
                {
                    "id": str(habit.id),
                    "title": habit.title,
                    "rate": rate,
                    "total_days": total_days,
                    "completed_days": completed_days,
                }
            )

        return {"habits": sorted(result_habits, key=lambda x: x["rate"], reverse=True)}

    async def get_correlations(self, user_id: uuid.UUID, days: int = 30) -> dict:
        today = date.today()
        start = today - timedelta(days=days - 1)
        habits = await self.habit_repo.list_by_user(user_id, status="active")
        if len(habits) < 2:
            return {"pairs": []}

        date_range = [start + timedelta(days=i) for i in range(days)]

        completed_map: dict[uuid.UUID, set[date]] = {}
        for habit in habits:
            completed_map[habit.id] = await self.log_repo.get_completed_dates(
                habit.id, start, today
            )

        pairs = []
        habit_list = list(habits)
        for i in range(len(habit_list)):
            for j in range(i + 1, len(habit_list)):
                a, b = habit_list[i], habit_list[j]
                common_dates = [
                    d
                    for d in date_range
                    if HabitService.is_scheduled(a, d) and HabitService.is_scheduled(b, d)
                ]
                if len(common_dates) < 5:
                    continue
                va = [1 if d in completed_map[a.id] else 0 for d in common_dates]
                vb = [1 if d in completed_map[b.id] else 0 for d in common_dates]
                corr = _pearson(va, vb)
                pairs.append(
                    {
                        "habit_a": str(a.id),
                        "habit_b": str(b.id),
                        "habit_a_title": a.title,
                        "habit_b_title": b.title,
                        "correlation": round(corr, 2),
                    }
                )

        return {"pairs": sorted(pairs, key=lambda x: abs(x["correlation"]), reverse=True)}

    async def get_stats_summary(self, user_id: uuid.UUID, days: int = 7) -> str:
        """주간 회고 프롬프트에 주입할 습관 통계 요약 텍스트"""
        trends = await self.get_trends(user_id, days=days)
        completion = await self.get_completion(user_id, days=days)

        if not trends["daily"]:
            return ""

        overall = sum(d["rate"] for d in trends["daily"]) / len(trends["daily"])
        lines = [f"[습관 통계 - 최근 {days}일]"]
        lines.append(f"- 평균 완료율: {overall:.0f}%")
        for h in completion["habits"]:
            lines.append(
                f"- {h['title']}: {h['rate']}% ({h['completed_days']}/{h['total_days']}일)"
            )
        return "\n".join(lines)

    async def generate_insight(self, user_id: uuid.UUID) -> dict:
        """LLM 기반 습관 코칭 인사이트 생성 + DB 저장"""
        if not self.llm:
            return {
                "content": "LLM 서비스를 사용할 수 없습니다.",
                "generated_at": date.today().isoformat(),
            }

        trends = await self.get_trends(user_id, days=30)
        completion = await self.get_completion(user_id, days=30)
        correlations = await self.get_correlations(user_id, days=30)

        current_rate = (
            sum(d["rate"] for d in trends["daily"]) / len(trends["daily"]) if trends["daily"] else 0
        )

        habits = await self.habit_repo.list_by_user(user_id, status="active")
        streaks = []
        for h in habits:
            s = await self.habit_service.get_streak(h, date.today())
            streaks.append(f"- {h.title}: {s}일")
        streaks_text = "\n".join(streaks) if streaks else "없음"

        completion_list = (
            "\n".join(
                f"- {h['title']}: {h['rate']}% ({h['completed_days']}/{h['total_days']}일)"
                for h in completion["habits"]
            )
            or "없음"
        )

        weekday_text = ", ".join(f"{w['day']}:{w['rate']}%" for w in trends["weekday"])

        corr_text = (
            "\n".join(
                f"- {p['habit_a_title']} ↔ {p['habit_b_title']}: {p['correlation']}"
                for p in correlations["pairs"][:5]
            )
            or "없음"
        )

        prompt = f"""당신은 ALMA 습관 코치입니다. 사용자의 습관 데이터를 분석하고 실천 가능한 조언을 한국어로 제공하세요.

[습관 분석 데이터 - 최근 30일]
- 전체 완료율: {current_rate:.0f}%
- 습관별 완료율:
{completion_list}
- 요일별 패턴: {weekday_text}
- 상관관계:
{corr_text}
- 현재 streak:
{streaks_text}

다음 형식으로 마크다운 분석해주세요:
1. 잘하고 있는 점 (구체적 데이터 인용)
2. 개선할 점 (실천 가능한 제안)
3. 발견된 패턴 (상관관계, 요일별 차이 등)
4. 다음 주 추천 액션 (1-2개)"""

        request = LLMRequest(
            messages=[ChatMessage(role="user", content=prompt)],
            max_tokens=1500,
            temperature=0.5,
        )
        response = await self.llm.complete(request)

        insight = await self.insight_repo.create(
            user_id=user_id,
            category="habit_pattern",
            title="습관 분석",
            content=response.content,
        )

        return {
            "id": str(insight.id),
            "content": response.content,
            "generated_at": insight.created_at.isoformat(),
        }
