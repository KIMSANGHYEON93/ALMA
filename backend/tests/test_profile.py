import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from alma.domain.identity.service import create_access_token, hash_password
from alma.main import app
from alma.models.models import User


@pytest.mark.asyncio
async def test_get_preferences(db_session):
    user = User(
        email=f"pref_{uuid.uuid4().hex[:8]}@test.com",
        password_hash=hash_password("pass"),
    )
    db_session.add(user)
    await db_session.flush()

    token = create_access_token(str(user.id))
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get(
            "/api/users/me/preferences",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["language"] == "ko"
    assert data["response_style"] == "concise"


@pytest.mark.asyncio
async def test_update_preferences(db_session):
    user = User(
        email=f"pref2_{uuid.uuid4().hex[:8]}@test.com",
        password_hash=hash_password("pass"),
    )
    db_session.add(user)
    await db_session.flush()

    token = create_access_token(str(user.id))
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.put(
            "/api/users/me/preferences",
            headers={"Authorization": f"Bearer {token}"},
            json={"language": "en", "response_style": "detailed", "interests": ["tech"]},
        )
    assert resp.status_code == 200
    assert resp.json()["language"] == "en"


@pytest.mark.asyncio
async def test_put_ignores_learned_field(db_session):
    user = User(
        email=f"pref3_{uuid.uuid4().hex[:8]}@test.com",
        password_hash=hash_password("pass"),
    )
    db_session.add(user)
    await db_session.flush()

    token = create_access_token(str(user.id))
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        await client.put(
            "/api/users/me/preferences",
            headers={"Authorization": f"Bearer {token}"},
            json={"language": "ko"},
        )
        resp = await client.get(
            "/api/users/me/preferences",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert "injected" not in resp.json().get("learned", {})
