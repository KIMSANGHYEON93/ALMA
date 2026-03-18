import uuid

import pytest

from alma.domain.identity.service import hash_password
from alma.domain.memory.repository import UserMemoryRepository
from alma.models.models import User


@pytest.mark.asyncio
async def test_create_and_list_memory(db_session):
    user = User(
        email=f"mem_{uuid.uuid4().hex[:8]}@test.com",
        password_hash=hash_password("pass"),
    )
    db_session.add(user)
    await db_session.flush()

    repo = UserMemoryRepository(db_session)
    await repo.create(user_id=user.id, category="fact", content="User likes Python")
    await repo.create(user_id=user.id, category="preference", content="Prefers concise answers")

    facts = await repo.list_by_user(user.id, category="fact")
    assert len(facts) == 1
    assert "Python" in facts[0].content

    all_memories = await repo.list_by_user(user.id)
    assert len(all_memories) == 2
