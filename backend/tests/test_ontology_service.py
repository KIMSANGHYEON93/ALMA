import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.ontology.repository import (
    ObjectTypeRepository,
    LinkTypeRepository,
    ActionTypeRepository,
)
from alma.domain.ontology.seed import SystemSeed
from alma.domain.ontology.validator import SchemaValidator
from alma.domain.ontology.models import NodeCandidate


@pytest.mark.asyncio
async def test_system_seed_creates_types(db_session: AsyncSession, test_user):
    seed = SystemSeed(db_session)
    await seed.seed_for_user(test_user.id)

    ot_repo = ObjectTypeRepository(db_session)
    object_types = await ot_repo.list_by_user(test_user.id)
    assert len(object_types) == 13

    lt_repo = LinkTypeRepository(db_session)
    link_types = await lt_repo.list_by_user(test_user.id)
    assert len(link_types) == 10

    at_repo = ActionTypeRepository(db_session)
    create_action = await at_repo.get_by_name(test_user.id, "create_object")
    assert create_action is not None
    assert create_action.is_system is True


@pytest.mark.asyncio
async def test_system_seed_idempotent(db_session: AsyncSession, test_user):
    seed = SystemSeed(db_session)
    await seed.seed_for_user(test_user.id)
    await seed.seed_for_user(test_user.id)

    ot_repo = ObjectTypeRepository(db_session)
    object_types = await ot_repo.list_by_user(test_user.id)
    assert len(object_types) == 13


def test_validate_category_valid():
    v = SchemaValidator()
    assert v.validate_category("Entity") is True
    assert v.validate_category("Action") is True


def test_validate_category_invalid():
    v = SchemaValidator()
    assert v.validate_category("Invalid") is False


def test_normalize_removes_none():
    v = SchemaValidator()
    result = v.normalize({"a": 1, "b": None, "c": "hello"})
    assert result == {"a": 1, "c": "hello"}


def test_infer_schema():
    v = SchemaValidator()
    result = v.infer_schema({"name": "test", "count": 5, "active": True})
    assert result == {"name": "str", "count": "int", "active": "bool"}


# ── OntologyService Tests ──────────────────────────────────────────────────────

from alma.domain.ontology.service import OntologyService  # noqa: E402


@pytest.mark.asyncio
async def test_ontology_service_create_object(db_session: AsyncSession, test_user):
    seed = SystemSeed(db_session)
    await seed.seed_for_user(test_user.id)

    service = OntologyService(db_session, embedding_provider=None)
    candidate = NodeCandidate(
        name="Learn Python",
        parent_category="Action",
        sub_type="Goal",
        properties={"category": "learning"},
        confidence=1.0,
        source_type="goal",
    )
    obj_id = await service.create_object(test_user.id, candidate)
    assert obj_id is not None

    obj = await service.get_object(obj_id)
    assert obj.name == "Learn Python"
    assert obj.status == "draft"


@pytest.mark.asyncio
async def test_ontology_service_get_schema_context(db_session: AsyncSession, test_user):
    await SystemSeed(db_session).seed_for_user(test_user.id)
    service = OntologyService(db_session, embedding_provider=None)
    ctx = await service.get_user_schema_context(test_user.id)
    assert "Goal" in ctx.object_type_names
    assert "supports" in ctx.link_type_names


@pytest.mark.asyncio
async def test_ontology_service_verify_object(db_session: AsyncSession, test_user):
    await SystemSeed(db_session).seed_for_user(test_user.id)
    service = OntologyService(db_session, embedding_provider=None)
    candidate = NodeCandidate(
        name="Test Node",
        parent_category="Concept",
        sub_type="Topic",
        properties={},
        confidence=0.7,
        source_type="manual",
    )
    obj_id = await service.create_object(test_user.id, candidate)
    await service.verify_object(obj_id)
    obj = await service.get_object(obj_id)
    assert obj.status == "verified"
