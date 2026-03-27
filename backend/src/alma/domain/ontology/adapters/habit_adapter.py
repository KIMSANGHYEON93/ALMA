import uuid

from alma.core.events.models import DomainEvent
from alma.domain.ontology.adapters.base import DomainAdapter
from alma.domain.ontology.models import EdgeCandidate, NodeCandidate, RawExtraction


class HabitAdapter(DomainAdapter):
    async def handle(self, event: DomainEvent) -> None:
        p = event.payload
        user_id = uuid.UUID(event.user_id)

        if event.event_type == "habit.created":
            extraction = RawExtraction(
                node_candidates=[
                    NodeCandidate(
                        name=p["title"],
                        parent_category="Action",
                        sub_type="Habit",
                        properties={"frequency": p.get("frequency_type")},
                        confidence=1.0,
                        source_type="habit",
                        source_id=uuid.UUID(p["habit_id"]),
                    )
                ],
            )
            goal_id = p.get("goal_id")
            if goal_id:
                goal_obj = await self.ontology.find_by_source("goal", uuid.UUID(goal_id))
                if goal_obj:
                    extraction.edge_candidates.append(
                        EdgeCandidate(
                            source_name=p["title"],
                            target_name=goal_obj.name,
                            relation="supports",
                            properties={},
                            confidence=1.0,
                            source_origin="system",
                        )
                    )
            await self.pipeline.process(extraction, user_id)

        elif event.event_type == "habit.deleted":
            obj = await self.ontology.find_by_source("habit", uuid.UUID(p["habit_id"]))
            if obj:
                await self.ontology.archive_object(obj.id)
