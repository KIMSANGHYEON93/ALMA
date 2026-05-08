import json
import logging
import re

from alma.infrastructure.llm.base import ChatMessage, LLMRequest
from alma.infrastructure.llm.router import LLMRouter

logger = logging.getLogger(__name__)


def _parse_json_lenient(content: str) -> dict:
    text = (content or "").strip()
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, flags=re.DOTALL)
    if fence:
        text = fence.group(1)
    else:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            text = text[start : end + 1]
    return json.loads(text)

ACTION_PLAN_PROMPT = """
당신은 온톨로지 자동화 에이전트입니다. 인사이트를 기반으로 구체적인 행동 계획을 생성합니다.

## 인사이트
타입: {insight_type}
제목: {title}
설명: {description}
근거: {evidence}

## 규칙 설정
행동 타입: {action_type}
설정: {config}

## 행동 타입별 출력 형식
- create_link: {{"action": "create_link", "params": {{"source_name": "...", "target_name": "...", "relation": "supports"}}}}
- create_node: {{"action": "create_node", "params": {{"name": "...", "category": "...", "sub_type": "...", "properties": {{}}}}}}
- notification: {{"action": "notification", "params": {{"message": "..."}}}}
- suggest: {{"action": "suggest", "params": {{"suggestion": "..."}}}}

JSON만 출력하세요.
"""


class ActionPlanner:
    def __init__(self, llm_router: LLMRouter | None = None):
        self.llm_router = llm_router

    async def plan(self, insight, automation) -> dict | None:  # noqa: ANN001
        if not self.llm_router:
            # No LLM available — return simple default plan
            return {
                "action": automation.action_type,
                "params": {"message": f"인사이트 '{insight.title}'에 대한 행동이 필요합니다."},
            }

        prompt = ACTION_PLAN_PROMPT.format(
            insight_type=insight.insight_type,
            title=insight.title,
            description=insight.description,
            evidence=json.dumps(insight.evidence, ensure_ascii=False, default=str),
            action_type=automation.action_type,
            config=json.dumps(automation.config, ensure_ascii=False, default=str),
        )

        try:
            request = LLMRequest(
                messages=[ChatMessage(role="user", content=prompt)],
                system_prompt="You are an automation agent. Respond ONLY in JSON.",
                max_tokens=1024,
                temperature=0.3,
            )
            response = await self.llm_router.complete(request)
            return _parse_json_lenient(response.content)
        except Exception:
            logger.warning("ActionPlanner LLM failed", exc_info=True)
            return {
                "action": automation.action_type,
                "params": {"message": f"인사이트 '{insight.title}'에 대한 행동이 필요합니다."},
            }
