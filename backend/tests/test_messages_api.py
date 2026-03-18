import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from alma.domain.identity.service import create_access_token, hash_password
from alma.main import app
from alma.models.models import Conversation, Message, User


@pytest.mark.asyncio
async def test_get_messages_empty(db_session):
    user = User(
        email=f"msg_{uuid.uuid4().hex[:8]}@test.com",
        password_hash=hash_password("pass"),
    )
    db_session.add(user)
    await db_session.flush()
    conv = Conversation(user_id=user.id)
    db_session.add(conv)
    await db_session.flush()

    token = create_access_token(str(user.id))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            f"/api/conversations/{conv.id}/messages",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["messages"] == []
    assert data["has_more"] is False


@pytest.mark.asyncio
async def test_get_messages_other_user_404(db_session):
    user1 = User(
        email=f"u1_{uuid.uuid4().hex[:8]}@test.com",
        password_hash=hash_password("pass"),
    )
    user2 = User(
        email=f"u2_{uuid.uuid4().hex[:8]}@test.com",
        password_hash=hash_password("pass"),
    )
    db_session.add_all([user1, user2])
    await db_session.flush()
    conv = Conversation(user_id=user1.id)
    db_session.add(conv)
    await db_session.flush()

    token = create_access_token(str(user2.id))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            f"/api/conversations/{conv.id}/messages",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_messages_with_pagination(db_session):
    user = User(
        email=f"pag_{uuid.uuid4().hex[:8]}@test.com",
        password_hash=hash_password("pass"),
    )
    db_session.add(user)
    await db_session.flush()
    conv = Conversation(user_id=user.id)
    db_session.add(conv)
    await db_session.flush()

    # Create 5 messages
    for i in range(5):
        db_session.add(Message(conversation_id=conv.id, role="user", content=f"msg {i}"))
    await db_session.flush()

    token = create_access_token(str(user.id))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Get first page (limit 3)
        resp = await client.get(
            f"/api/conversations/{conv.id}/messages?limit=3",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["messages"]) == 3
    assert data["has_more"] is True
