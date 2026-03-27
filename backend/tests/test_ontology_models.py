def test_ontology_models_importable():
    from alma.models.models import (
        LinkType,
        ObjectType,
        OntologyActionLog,
        OntologyActionType,
        OntologyLink,
        OntologyObject,
    )

    assert ObjectType.__tablename__ == "ontology_object_types"
    assert OntologyObject.__tablename__ == "ontology_objects"
    assert LinkType.__tablename__ == "ontology_link_types"
    assert OntologyLink.__tablename__ == "ontology_links"
    assert OntologyActionType.__tablename__ == "ontology_action_types"
    assert OntologyActionLog.__tablename__ == "ontology_action_logs"


def test_node_candidate_defaults():
    from alma.domain.ontology.models import NodeCandidate
    nc = NodeCandidate(name="Test", parent_category="Action", sub_type="Goal", properties={}, confidence=0.9)
    assert nc.action == "create"
    assert nc.status == "draft"
    assert nc.source_type == "llm_extracted"

def test_raw_extraction_from_llm_response():
    from alma.domain.ontology.models import RawExtraction
    json_str = '{"nodes": [{"name": "Python", "parent_category": "Concept", "sub_type": "Skill", "properties": {"level": "intermediate"}, "confidence": 0.9}], "edges": []}'
    result = RawExtraction.from_llm_response(json_str)
    assert len(result.node_candidates) == 1
    assert result.node_candidates[0].name == "Python"

def test_raw_extraction_from_invalid_json():
    from alma.domain.ontology.models import RawExtraction
    result = RawExtraction.from_llm_response("not json")
    assert len(result.node_candidates) == 0

def test_purification_result_defaults():
    from alma.domain.ontology.models import PurificationResult
    result = PurificationResult()
    assert result.created_objects == []
    assert result.rejected_count == 0


def test_ontology_config_importable():
    from alma.config import settings

    assert settings.ontology_dedup_auto_merge_threshold == 0.98
    assert settings.ontology_dedup_review_threshold == 0.92
    assert settings.ontology_confidence_auto_verify == 0.8
    assert settings.ontology_confidence_reject == 0.5
    assert settings.ontology_chat_min_length == 30
