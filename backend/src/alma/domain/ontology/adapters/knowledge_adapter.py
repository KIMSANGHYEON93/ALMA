import uuid

from alma.core.events.models import DomainEvent
from alma.domain.ontology.extractor import SemanticExtractor
from alma.domain.ontology.pipeline import PurificationPipeline


class KnowledgeAdapter:
    def __init__(self, extractor: SemanticExtractor, pipeline: PurificationPipeline):
        self.extractor = extractor
        self.pipeline = pipeline

    async def handle(self, event: DomainEvent) -> None:
        p = event.payload
        user_id = uuid.UUID(event.user_id)
        extraction = await self.extractor.extract(
            f"Document: {p['title']}\n{p.get('content', '')[:2000]}",
            user_id,
        )
        for node in extraction.node_candidates:
            node.source_type = "knowledge"
            node.source_id = uuid.UUID(p["document_id"])
        await self.pipeline.process(extraction, user_id)
