import uuid

from alma.core.events.models import DomainEvent
from alma.domain.ontology.adapters.base import DomainAdapter
from alma.domain.ontology.models import NodeCandidate, RawExtraction


class GoalAdapter(DomainAdapter):
    async def handle(self, event: DomainEvent) -> None:
        p = event.payload
        user_id = uuid.UUID(event.user_id)

        if event.event_type == "goal.created":
            extraction = RawExtraction(
                node_candidates=[
                    NodeCandidate(
                        name=p["title"],
                        parent_category="Action",
                        sub_type="Goal",
                        properties={k: v for k, v in p.items() if k not in ("goal_id", "title")},
                        confidence=1.0,
                        source_type="goal",
                        source_id=uuid.UUID(p["goal_id"]),
                    )
                ],
            )
            await self.pipeline.process(extraction, user_id)

        elif event.event_type == "goal.updated":
            obj = await self.ontology.find_by_source("goal", uuid.UUID(p["goal_id"]))
            if obj:
                await self.ontology.update_object_properties(obj.id, p.get("changed", {}))

        elif event.event_type == "goal.deleted":
            obj = await self.ontology.find_by_source("goal", uuid.UUID(p["goal_id"]))
            if obj:
                await self.ontology.archive_object(obj.id)
