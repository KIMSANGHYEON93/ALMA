import pytest
from httpx import ASGITransport, AsyncClient

from alma.auth.auth import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)
from alma.main import app


def test_password_hash_and_verify():
    hashed = hash_password("mypassword")
    assert verify_password("mypassword", hashed) is True
    assert verify_password("wrongpassword", hashed) is False


def test_create_and_decode_token():
    token = create_access_token("user-123")
    payload = decode_token(token)
    assert payload["sub"] == "user-123"


@pytest.mark.asyncio
async def test_register_user(db_session):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/auth/register",
            json={
                "email": "new@example.com",
                "password": "securepass123",
                "display_name": "New User",
            },
        )
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_login_user(db_session):
    # Register first
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post(
            "/api/auth/register",
            json={"email": "login@example.com", "password": "securepass123"},
        )
        resp = await client.post(
            "/api/auth/login",
            json={"email": "login@example.com", "password": "securepass123"},
        )
    assert resp.status_code == 200
    assert "access_token" in resp.json()
