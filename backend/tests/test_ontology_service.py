import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.ontology.repository import ObjectTypeRepository, LinkTypeRepository, ActionTypeRepository
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
