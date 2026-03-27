import pytest


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


def test_ontology_config_importable():
    from alma.config import settings

    assert settings.ontology_dedup_auto_merge_threshold == 0.98
    assert settings.ontology_dedup_review_threshold == 0.92
    assert settings.ontology_confidence_auto_verify == 0.8
    assert settings.ontology_confidence_reject == 0.5
    assert settings.ontology_chat_min_length == 30
