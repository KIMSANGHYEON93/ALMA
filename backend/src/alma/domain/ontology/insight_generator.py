import json
import logging
import uuid

from alma.domain.ontology.repository import InsightRepository
from alma.infrastructure.llm.base import ChatMessage, LLMRequest
from alma.infrastructure.llm.router import LLMRouter

logger = logging.getLogger(__name__)

INSIGHT_PROMPT = """
당신은 개인 성장 코치입니다. 사용자의 지식 그래프 분석 결과를 바탕으로 실행 가능한 인사이트를 제공합니다.

## 분석 결과
{analysis_json}

## 규칙
1. 각 의미있는 패턴에 대해 인사이트 생성
2. 한국어로 제목 + 설명 + 구체적 행동 제안
3. 데이터에 근거한 구체적 인사이트만 (모호한 조언 금지)
4. 인사이트가 없는 분석 항목은 건너뛰기
5. 최대 10개 인사이트

## 출력 (JSON만)
{{"insights": [{{"type": "hub_node|isolated|strong_path|conflict|opportunity|trend", "title": "짧은 제목", "description": "2-3문장 설명", "action": "구체적 행동 제안 또는 null", "confidence": 0.0-1.0, "evidence_node_ids": ["uuid1"]}}]}}
"""


class InsightGenerator:
    def __init__(self, llm_router: LLMRouter, insight_repo: InsightRepository):
        self.llm_router = llm_router
        self.insight_repo = insight_repo

    async def generate(self, user_id: uuid.UUID, analysis: dict) -> list:
        prompt = INSIGHT_PROMPT.format(
            analysis_json=json.dumps(analysis, ensure_ascii=False, default=str)
        )
        request = LLMRequest(
            messages=[ChatMessage(role="user", content=prompt)],
            system_prompt="You are a personal growth coach analyzing knowledge graphs. Respond ONLY in JSON.",
            max_tokens=4096,
            temperature=0.5,
        )

        try:
            response = await self.llm_router.complete(request)
            parsed = json.loads(response.content)
        except Exception:
            logger.warning("Failed to generate insights via LLM", exc_info=True)
            return []

        insights = []
        for item in parsed.get("insights", []):
            try:
                insight = await self.insight_repo.create(
                    user_id=user_id,
                    insight_type=item.get("type", "trend"),
                    title=item["title"],
                    description=item["description"],
                    evidence={"node_ids": item.get("evidence_node_ids", [])},
                    confidence=item.get("confidence", 0.5),
                    actionable=item.get("action") is not None,
                    action_suggestion=item.get("action"),
                )
                insights.append(insight)
            except Exception:
                logger.warning(
                    "Failed to save insight: %s", item.get("title"), exc_info=True
                )
                continue
        return insights
