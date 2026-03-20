import json
import logging
import uuid
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.growth.service import GoalService
from alma.domain.insight.repository import InsightRepository, RetrospectiveRepository
from alma.infrastructure.llm.base import ChatMessage, LLMProvider, LLMRequest
from alma.models.models import Retrospective

logger = logging.getLogger(__name__)

MAX_MESSAGES = 50
MAX_CONTENT_LENGTH = 200

ANALYSIS_PROMPT = """Analyze this user's week. Respond in Korean.

## Messages (last 7 days, sampled)
{messages_summary}

## Goals Status
{goals_summary}

Respond with valid JSON only (no markdown, no explanation):
{{
  "summary": "2-3 sentence weekly summary in Korean",
  "highlights": ["achievement 1", "achievement 2"],
  "challenges": ["challenge 1"],
  "insights": [
    {{
      "category": "topic_trend|goal_pattern|activity_pattern|recommendation",
      "title": "short insight title",
      "content": "detailed insight explanation"
    }}
  ]
}}"""


class InsightService:
    def __init__(
        self,
        session: AsyncSession,
        llm: LLMProvider,
        goal_service: GoalService | None = None,
    ):
        self.session = session
        self.llm = llm
        self.goal_service = goal_service
        self.retro_repo = RetrospectiveRepository(session)
        self.insight_repo = InsightRepository(session)

    async def generate_weekly_retrospective(
        self, user_id: uuid.UUID, end_date: date | None = None
    ) -> Retrospective:
        period_end = end_date or date.today()
        period_start = period_end - timedelta(days=7)

        # 중복 체크
        existing = await self.retro_repo.get_by_period(
            user_id, "weekly", period_start
        )
        if existing:
            return existing

        # 데이터 수집
        messages = await self.retro_repo.get_period_messages(
            user_id, period_start, period_end, limit=MAX_MESSAGES
        )
        conv_count = await self.retro_repo.count_conversations(
            user_id, period_start, period_end
        )
        msg_count = await self.retro_repo.count_messages(
            user_id, period_start, period_end
        )

        # 목표 스냅샷 (Anti-Corruption: GoalService 공개 메서드만)
        goals_data: dict = {}
        if self.goal_service:
            goals_data = await self.goal_service.get_summary(user_id)

        # 빈 주 처리 — LLM 호출 없이 기본 템플릿
        if not messages:
            retro = await self.retro_repo.create(
                user_id=user_id,
                period_type="weekly",
                period_start=period_start,
                period_end=period_end,
                summary="이번 주는 활동이 없었습니다. 다음 주에 다시 시작해보세요!",
                highlights=[],
                challenges=[],
                goals_progress=goals_data,
                conversation_count=0,
                message_count=0,
            )
            return retro

        # 메시지 샘플링 + LLM 분석
        messages_summary = "\n".join(
            f"[{m.role}] {m.content[:MAX_CONTENT_LENGTH]}"
            for m in messages[:MAX_MESSAGES]
        )
        goals_summary = json.dumps(goals_data, ensure_ascii=False) if goals_data else "No goals set"

        analysis = await self._analyze_with_llm(messages_summary, goals_summary)

        # 회고 저장
        week_num = period_start.isocalendar()[1]
        source_period = f"{period_start.isocalendar()[0]}-W{week_num:02d}"

        retro = await self.retro_repo.create(
            user_id=user_id,
            period_type="weekly",
            period_start=period_start,
            period_end=period_end,
            summary=analysis.get("summary", ""),
            highlights=analysis.get("highlights", []),
            challenges=analysis.get("challenges", []),
            goals_progress=goals_data,
            conversation_count=conv_count,
            message_count=msg_count,
        )

        # 인사이트 저장
        for insight_data in analysis.get("insights", []):
            try:
                await self.insight_repo.create(
                    user_id=user_id,
                    category=insight_data.get("category", "recommendation"),
                    title=insight_data.get("title", ""),
                    content=insight_data.get("content", ""),
                    source_period=source_period,
                    retrospective_id=retro.id,
                )
            except Exception:
                logger.warning("Failed to save insight", exc_info=True)

        return retro

    async def _analyze_with_llm(
        self, messages_summary: str, goals_summary: str
    ) -> dict:
        prompt = ANALYSIS_PROMPT.format(
            messages_summary=messages_summary, goals_summary=goals_summary
        )
        request = LLMRequest(
            messages=[ChatMessage(role="user", content=prompt)],
            max_tokens=2000,
            temperature=0.3,
        )
        try:
            response = await self.llm.complete(request)
            content = response.content.strip()
            # JSON 블록 추출 (```json ... ``` 패턴 대응)
            if "```" in content:
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            return json.loads(content)
        except (json.JSONDecodeError, IndexError, KeyError) as e:
            logger.warning("LLM JSON parse failed: %s", e)
            return {
                "summary": "이번 주 활동을 분석했습니다.",
                "highlights": [],
                "challenges": [],
                "insights": [],
            }

    async def get_dashboard(self, user_id: uuid.UUID) -> dict:
        latest = await self.retro_repo.get_latest(user_id)
        recent_insights = await self.insight_repo.list_recent(user_id, limit=5)
        streak = await self.retro_repo.get_streak_days(user_id)

        goals_data: dict = {"active_goals": 0, "total_goals": 0, "average_progress": 0}
        if self.goal_service:
            goals_data = await self.goal_service.get_summary(user_id)

        return {
            "latest_retrospective": self._retro_to_dict(latest) if latest else None,
            "recent_insights": [self._insight_to_dict(i) for i in recent_insights],
            "stats": {
                "active_goals": goals_data.get("active_goals", 0),
                "completed_goals": goals_data.get("total_goals", 0) - goals_data.get("active_goals", 0),
                "streak_days": streak,
            },
        }

    async def list_retrospectives(
        self, user_id: uuid.UUID, limit: int = 10
    ) -> list[dict]:
        retros = await self.retro_repo.list_by_user(user_id, limit)
        return [self._retro_to_dict(r) for r in retros]

    async def get_retrospective_detail(
        self, retro_id: uuid.UUID, user_id: uuid.UUID
    ) -> dict | None:
        retro = await self.retro_repo.get(retro_id)
        if not retro or retro.user_id != user_id:
            return None
        insights = await self.insight_repo.list_by_retrospective(retro.id)
        result = self._retro_to_dict(retro)
        result["insights"] = [self._insight_to_dict(i) for i in insights]
        return result

    @staticmethod
    def _retro_to_dict(r: Retrospective) -> dict:
        return {
            "id": str(r.id),
            "period_type": r.period_type,
            "period_start": str(r.period_start),
            "period_end": str(r.period_end),
            "summary": r.summary,
            "highlights": r.highlights,
            "challenges": r.challenges,
            "goals_progress": r.goals_progress,
            "conversation_count": r.conversation_count,
            "message_count": r.message_count,
            "created_at": r.created_at.isoformat(),
        }

    @staticmethod
    def _insight_to_dict(i) -> dict:
        return {
            "id": str(i.id),
            "category": i.category,
            "title": i.title,
            "content": i.content,
            "data": i.data,
            "source_period": i.source_period,
            "created_at": i.created_at.isoformat(),
        }
