import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from alma.core.events.models import DomainEvent
from alma.domain.ontology.adapters.chat_adapter import SKIP_PATTERNS, ChatAdapter
from alma.domain.ontology.adapters.goal_adapter import GoalAdapter
from alma.domain.ontology.adapters.memory_adapter import MemoryAdapter
from alma.domain.ontology.dedup import DeduplicationService
from alma.domain.ontology.pipeline import PurificationPipeline
from alma.domain.ontology.seed import SystemSeed
from alma.domain.ontology.service import OntologyService
from alma.domain.ontology.validator import SchemaValidator


@pytest.fixture
async def ontology_setup(db_session: AsyncSession, test_user):
    await SystemSeed(db_session).seed_for_user(test_user.id)
    service = OntologyService(db_session, embedding_provider=None)
    pipeline = PurificationPipeline(
        DeduplicationService(db_session), SchemaValidator(), service,
    )
    return service, pipeline


def test_skip_patterns_matches_short_responses():
    assert SKIP_PATTERNS.match("네 알겠습니다")
    assert SKIP_PATTERNS.match("ok")
    assert SKIP_PATTERNS.match("감사합니다")
    assert not SKIP_PATTERNS.match("내일 운동을 시작하려고 하는데 어떤 루틴이 좋을까?")


@pytest.mark.asyncio
async def test_goal_adapter_creates_object(db_session, test_user, ontology_setup):
    service, pipeline = ontology_setup
    adapter = GoalAdapter(pipeline, service)
    event = DomainEvent(
        event_type="goal.created",
        source="growth",
        payload={"goal_id": str(uuid.uuid4()), "title": "Learn Rust"},
        user_id=str(test_user.id),
    )
    await adapter.handle(event)
    obj = await service.find_object_by_name(test_user.id, "Learn Rust")
    assert obj is not None
    assert obj.source_type == "goal"
    assert obj.confidence == 1.0


@pytest.mark.asyncio
async def test_chat_adapter_skips_short_message(db_session, test_user, ontology_setup):
    service, pipeline = ontology_setup
    adapter = ChatAdapter(extractor=None, pipeline=pipeline)
    event = DomainEvent(
        event_type="message.received",
        source="chat",
        payload={"role": "user", "content": "네"},
        user_id=str(test_user.id),
    )
    await adapter.handle(event)  # should not raise


@pytest.mark.asyncio
async def test_chat_adapter_skips_assistant_message(db_session, test_user, ontology_setup):
    service, pipeline = ontology_setup
    adapter = ChatAdapter(extractor=None, pipeline=pipeline)
    event = DomainEvent(
        event_type="message.received",
        source="chat",
        payload={"role": "assistant", "content": "Here is a long response about many things"},
        user_id=str(test_user.id),
    )
    await adapter.handle(event)  # should not raise


@pytest.mark.asyncio
async def test_memory_adapter_creates_object(db_session, test_user, ontology_setup):
    service, pipeline = ontology_setup
    adapter = MemoryAdapter(pipeline, service)
    event = DomainEvent(
        event_type="memory.created",
        source="memory",
        payload={
            "memory_id": str(uuid.uuid4()),
            "content": "User prefers dark mode and minimal UI",
            "category": "preference",
        },
        user_id=str(test_user.id),
    )
    await adapter.handle(event)
    objects = await service.obj_repo.list_by_user(test_user.id)
    memory_objs = [o for o in objects if o.source_type == "memory"]
    assert len(memory_objs) == 1
