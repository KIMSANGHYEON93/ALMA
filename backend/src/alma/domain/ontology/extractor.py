import json
import uuid

from alma.domain.ontology.models import RawExtraction
from alma.domain.ontology.service import OntologyService
from alma.infrastructure.llm.base import ChatMessage, LLMRequest
from alma.infrastructure.llm.router import LLMRouter

EXTRACTION_SYSTEM_PROMPT = """
You are an expert at extracting structured knowledge from text.

## Upper Categories
- Entity: things that exist (Person, Project, Organization)
- Action: goals/activities (Goal, Habit, Task)
- Concept: abstract concepts (Topic, Skill, Value)
- Attribute: measurable properties (Metric, Emotion)
- Temporal: time-based (Event, Period)

## Rules
1. Missing is better than ambiguous extraction (exclude if confidence < 0.5)
2. MUST reuse existing node/relationship types if available
3. Create new types only when existing types cannot represent the concept
4. Relationships are directional (source -> relation -> target)
5. If input is Korean, node names should also be Korean

## Output Format (JSON only)
{
  "nodes": [
    {
      "name": "node name",
      "parent_category": "Entity|Action|Concept|Attribute|Temporal",
      "sub_type": "sub type (prefer existing types)",
      "properties": {"key": "value"},
      "confidence": 0.0-1.0
    }
  ],
  "edges": [
    {
      "source_name": "source node name",
      "target_name": "target node name",
      "relation": "relationship type (prefer existing types)",
      "properties": {"key": "value"},
      "confidence": 0.0-1.0
    }
  ]
}
"""


class SemanticExtractor:
    def __init__(self, llm_router: LLMRouter, ontology_service: OntologyService):
        self.llm_router = llm_router
        self.ontology_service = ontology_service

    async def extract(self, text: str, user_id: uuid.UUID) -> RawExtraction:
        context = await self.ontology_service.get_user_schema_context(user_id)

        user_prompt = f"""
Existing Object Types: {context.object_type_names}
Existing Link Types: {context.link_type_names}
Recent nodes (reference): {context.recent_node_names[:20]}

---
Text to extract:
{text}

Respond ONLY in JSON format.
"""
        request = LLMRequest(
            messages=[ChatMessage(role="user", content=user_prompt)],
            system_prompt=EXTRACTION_SYSTEM_PROMPT,
            max_tokens=2048,
            temperature=0.3,
        )
        response = await self.llm_router.complete(request)

        parsed = RawExtraction.from_llm_response(response.content)

        for node in parsed.node_candidates:
            node.embedding = await self.ontology_service.generate_embedding(
                f"{node.name} {node.sub_type} {json.dumps(node.properties, ensure_ascii=False)}"
            )

        return parsed
