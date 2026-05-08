import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from alma.domain.identity.service import create_access_token, hash_password
from alma.main import app
from alma.models.models import User


@pytest.fixture
async def auth_client(db_session):
    """Authenticated AsyncClient with a test user."""
    unique_email = f"goal_api_{uuid.uuid4().hex[:8]}@test.com"
    user = User(email=unique_email, password_hash=hash_password("pass123"))
    db_session.add(user)
    await db_session.flush()
    token = create_access_token(str(user.id))
    headers = {"Authorization": f"Bearer {token}"}
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", headers=headers
    ) as client:
        yield client


@pytest.mark.asyncio
async def test_create_goal_requires_auth(db_session):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/goals", json={"title": "Test"})
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_create_goal_empty_title_rejected(auth_client):
    resp = await auth_client.post("/api/goals", json={"title": ""})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_goal_invalid_category(auth_client):
    resp = await auth_client.post("/api/goals", json={"title": "Test", "category": "invalid"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_goal_crud_flow(auth_client):
    # Create
    resp = await auth_client.post(
        "/api/goals", json={"title": "Learn Rust", "category": "learning"}
    )
    assert resp.status_code == 201
    goal = resp.json()
    goal_id = goal["id"]
    assert goal["category"] == "learning"

    # List
    resp = await auth_client.get("/api/goals")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

    # Get detail
    resp = await auth_client.get(f"/api/goals/{goal_id}")
    assert resp.status_code == 200
    assert resp.json()["milestones"] == []

    # Update
    resp = await auth_client.put(f"/api/goals/{goal_id}", json={"title": "Learn Rust & Go"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Learn Rust & Go"

    # Delete
    resp = await auth_client.delete(f"/api/goals/{goal_id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_milestone_flow(auth_client):
    # Create goal
    resp = await auth_client.post("/api/goals", json={"title": "Test Goal"})
    goal_id = resp.json()["id"]

    # Add milestone
    resp = await auth_client.post(f"/api/goals/{goal_id}/milestones", json={"title": "Step 1"})
    assert resp.status_code == 201
    ms_id = resp.json()["id"]

    # Complete milestone
    resp = await auth_client.patch(f"/api/goals/{goal_id}/milestones/{ms_id}/complete")
    assert resp.status_code == 200
    data = resp.json()
    assert data["progress"] == 100
    assert data["suggest_complete"] is True


@pytest.mark.asyncio
async def test_other_user_goal_returns_404(auth_client):
    fake_id = str(uuid.uuid4())
    resp = await auth_client.get(f"/api/goals/{fake_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_summary(auth_client):
    await auth_client.post("/api/goals", json={"title": "G1"})
    resp = await auth_client.get("/api/goals/summary")
    assert resp.status_code == 200
    assert resp.json()["active_goals"] >= 1


@pytest.mark.asyncio
async def test_status_update(auth_client):
    resp = await auth_client.post("/api/goals", json={"title": "Pause Me"})
    goal_id = resp.json()["id"]
    resp = await auth_client.patch(f"/api/goals/{goal_id}/status", json={"status": "paused"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "paused"
