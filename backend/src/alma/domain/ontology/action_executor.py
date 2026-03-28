import logging
import uuid

from alma.domain.ontology.models import NodeCandidate
from alma.domain.ontology.repository import AutomationLogRepository, InsightRepository
from alma.domain.ontology.service import OntologyService

logger = logging.getLogger(__name__)


class ActionExecutor:
    def __init__(
        self,
        ontology_service: OntologyService,
        log_repo: AutomationLogRepository,
        insight_repo: InsightRepository,
    ):
        self.ontology = ontology_service
        self.log_repo = log_repo
        self.insight_repo = insight_repo

    async def execute(
        self,
        plan: dict,
        automation_id: uuid.UUID,
        insight_id: uuid.UUID | None,
        user_id: uuid.UUID,
    ) -> dict:
        action = plan.get("action", "suggest")
        params = plan.get("params", {})
        result: dict = {"status": "success", "detail": ""}

        try:
            if action == "create_link":
                source = await self.ontology.find_object_by_name(user_id, params.get("source_name", ""))
                target = await self.ontology.find_object_by_name(user_id, params.get("target_name", ""))
                if source and target:
                    link_id = await self.ontology.create_link(
                        user_id,
                        params.get("relation", "related_to"),
                        source.id,
                        target.id,
                        confidence=0.7,
                        source_origin="system",
                    )
                    result["detail"] = f"Link created: {params.get('source_name')} → {params.get('target_name')}"
                    result["link_id"] = str(link_id)
                else:
                    result = {"status": "failed", "detail": "Source or target node not found"}

            elif action == "create_node":
                candidate = NodeCandidate(
                    name=params.get("name", "Auto-generated"),
                    parent_category=params.get("category", "Concept"),
                    sub_type=params.get("sub_type", "Topic"),
                    properties=params.get("properties", {}),
                    confidence=0.7,
                    source_type="manual",
                )
                candidate.status = "draft"
                obj_id = await self.ontology.create_object(user_id, candidate)
                result["detail"] = f"Node created: {params.get('name')}"
                result["object_id"] = str(obj_id)

            elif action == "notification":
                result["detail"] = params.get("message", "Action needed")
                # Future: integrate with push notification system

            elif action == "suggest":
                if insight_id:
                    insight = await self.insight_repo.get(insight_id)
                    if insight:
                        insight.action_suggestion = params.get("suggestion", params.get("message", ""))
                        insight.actionable = True
                result["detail"] = params.get("suggestion", params.get("message", ""))

            else:
                result = {"status": "failed", "detail": f"Unknown action: {action}"}

        except Exception as e:
            logger.warning("ActionExecutor failed: %s", e, exc_info=True)
            result = {"status": "failed", "detail": str(e)}

        # Log execution
        await self.log_repo.create(
            automation_id=automation_id,
            insight_id=insight_id,
            user_id=user_id,
            action_taken=f"{action}: {result.get('detail', '')}",
            result=result,
            status=result.get("status", "success"),
        )

        return result
