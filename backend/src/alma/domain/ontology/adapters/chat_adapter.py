import re
import uuid

from alma.config import settings
from alma.core.events.models import DomainEvent
from alma.domain.ontology.extractor import SemanticExtractor
from alma.domain.ontology.pipeline import PurificationPipeline

SKIP_PATTERNS = re.compile(
    r"^(네|예|아니요|알겠|좋아|감사|ㅇㅇ|ㅋ|ㅎ|ok|yes|no|thanks|sure)",
    re.IGNORECASE,
)


class ChatAdapter:
    def __init__(self, extractor: SemanticExtractor, pipeline: PurificationPipeline):
        self.extractor = extractor
        self.pipeline = pipeline

    async def handle(self, event: DomainEvent) -> None:
        p = event.payload
        if p.get("role") != "user":
            return
        content = p.get("content", "")
        if len(content) < settings.ontology_chat_min_length:
            return
        if SKIP_PATTERNS.match(content.strip()):
            return
        user_id = uuid.UUID(event.user_id)
        extraction = await self.extractor.extract(content, user_id)
        if extraction.node_candidates or extraction.edge_candidates:
            await self.pipeline.process(extraction, user_id)
