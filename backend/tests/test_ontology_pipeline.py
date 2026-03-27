import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.ontology.dedup import DeduplicationService
from alma.domain.ontology.extractor import EXTRACTION_SYSTEM_PROMPT
from alma.domain.ontology.models import NodeCandidate, RawExtraction
from alma.domain.ontology.pipeline import PurificationPipeline
from alma.domain.ontology.seed import SystemSeed
from alma.domain.ontology.service import OntologyService
from alma.domain.ontology.validator import SchemaValidator


def test_extraction_prompt_contains_categories():
    assert "Entity" in EXTRACTION_SYSTEM_PROMPT
    assert "Action" in EXTRACTION_SYSTEM_PROMPT
    assert "Concept" in EXTRACTION_SYSTEM_PROMPT
    assert "Attribute" in EXTRACTION_SYSTEM_PROMPT
    assert "Temporal" in EXTRACTION_SYSTEM_PROMPT


def test_raw_extraction_from_valid_json():
    json_str = '{"nodes": [{"name": "Python", "parent_category": "Concept", "sub_type": "Skill", "properties": {"level": "intermediate"}, "confidence": 0.9}], "edges": []}'
    result = RawExtraction.from_llm_response(json_str)
    assert len(result.node_candidates) == 1
    assert result.node_candidates[0].name == "Python"
    assert result.node_candidates[0].confidence == 0.9


def test_raw_extraction_from_invalid_json():
    result = RawExtraction.from_llm_response("not json at all")
    assert len(result.node_candidates) == 0
    assert len(result.edge_candidates) == 0


@pytest.mark.asyncio
async def test_pipeline_creates_verified_object(db_session: AsyncSession, test_user):
    await SystemSeed(db_session).seed_for_user(test_user.id)
    service = OntologyService(db_session, embedding_provider=None)
    pipeline = PurificationPipeline(
        DeduplicationService(db_session), SchemaValidator(), service,
    )
    extraction = RawExtraction(
        node_candidates=[
            NodeCandidate(
                name="Learn Rust", parent_category="Action", sub_type="Goal",
                properties={"category": "learning"}, confidence=0.9, source_type="goal",
            )
        ],
    )
    result = await pipeline.process(extraction, test_user.id)
    assert len(result.created_objects) == 1
    assert result.rejected_count == 0
    obj = await service.get_object(result.created_objects[0])
    assert obj.status == "verified"


@pytest.mark.asyncio
async def test_pipeline_rejects_low_confidence(db_session: AsyncSession, test_user):
    await SystemSeed(db_session).seed_for_user(test_user.id)
    service = OntologyService(db_session, embedding_provider=None)
    pipeline = PurificationPipeline(
        DeduplicationService(db_session), SchemaValidator(), service,
    )
    extraction = RawExtraction(
        node_candidates=[
            NodeCandidate(
                name="Maybe Something", parent_category="Concept", sub_type="Topic",
                properties={}, confidence=0.3, source_type="llm_extracted",
            )
        ],
    )
    result = await pipeline.process(extraction, test_user.id)
    assert result.rejected_count == 1
    assert len(result.created_objects) == 0


@pytest.mark.asyncio
async def test_pipeline_draft_medium_confidence(db_session: AsyncSession, test_user):
    await SystemSeed(db_session).seed_for_user(test_user.id)
    service = OntologyService(db_session, embedding_provider=None)
    pipeline = PurificationPipeline(
        DeduplicationService(db_session), SchemaValidator(), service,
    )
    extraction = RawExtraction(
        node_candidates=[
            NodeCandidate(
                name="Possible Skill", parent_category="Concept", sub_type="Skill",
                properties={"level": "beginner"}, confidence=0.65, source_type="llm_extracted",
            )
        ],
    )
    result = await pipeline.process(extraction, test_user.id)
    assert len(result.review_objects) == 1
    obj = await service.get_object(result.review_objects[0])
    assert obj.status == "draft"
