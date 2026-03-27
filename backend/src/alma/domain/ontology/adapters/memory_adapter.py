import uuid

from alma.core.events.models import DomainEvent
from alma.domain.ontology.adapters.base import DomainAdapter
from alma.domain.ontology.models import NodeCandidate, RawExtraction


class MemoryAdapter(DomainAdapter):
    async def handle(self, event: DomainEvent) -> None:
        p = event.payload
        user_id = uuid.UUID(event.user_id)
        extraction = RawExtraction(
            node_candidates=[
                NodeCandidate(
                    name=p["content"][:100],
                    parent_category="Concept",
                    sub_type=p.get("category", "fact"),
                    properties={"full_content": p["content"]},
                    confidence=0.9,
                    source_type="memory",
                    source_id=uuid.UUID(p["memory_id"]) if p.get("memory_id") else None,
                )
            ],
        )
        await self.pipeline.process(extraction, user_id)
