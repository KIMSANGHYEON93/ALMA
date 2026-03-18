import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from alma.domain.identity.service import create_access_token, hash_password
from alma.main import app
from alma.models.models import User


@pytest.mark.asyncio
async def test_list_conversations_requires_auth(db_session):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/conversations")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_create_and_list_conversations(db_session):
    unique_email = f"conv_test_{uuid.uuid4().hex[:8]}@example.com"
    user = User(email=unique_email, password_hash=hash_password("pass123"))
    db_session.add(user)
    await db_session.flush()

    token = create_access_token(str(user.id))
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        create_resp = await client.post(
            "/api/conversations",
            json={"title": "Test Conversation"},
            headers=headers,
        )
        assert create_resp.status_code == 201
        created = create_resp.json()
        assert created["title"] == "Test Conversation"

        list_resp = await client.get("/api/conversations", headers=headers)
        assert list_resp.status_code == 200
        conversations = list_resp.json()
        assert len(conversations) >= 1
        titles = [c["title"] for c in conversations]
        assert "Test Conversation" in titles
