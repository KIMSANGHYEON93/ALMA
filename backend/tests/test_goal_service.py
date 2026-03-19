import uuid

import pytest

from alma.domain.growth.models import GoalCategory, GoalStatus
from alma.domain.growth.repository import MilestoneRepository
from alma.domain.growth.service import GoalService


@pytest.mark.asyncio
async def test_goal_enums():
    assert GoalStatus.ACTIVE == "active"
    assert GoalCategory.HEALTH == "health"


@pytest.mark.asyncio
async def test_create_goal(db_session, test_user):
    service = GoalService(db_session)
    goal = await service.create_goal(test_user.id, "Learn Python", category="learning")
    assert goal.title == "Learn Python"
    assert goal.category == "learning"
    assert goal.status == "active"
    assert goal.progress == 0


@pytest.mark.asyncio
async def test_list_goals_by_user(db_session, test_user):
    service = GoalService(db_session)
    await service.create_goal(test_user.id, "Goal 1", category="personal")
    await service.create_goal(test_user.id, "Goal 2", category="health")
    goals = await service.list_goals(test_user.id)
    assert len(goals) == 2


@pytest.mark.asyncio
async def test_list_goals_filter_status(db_session, test_user):
    service = GoalService(db_session)
    await service.create_goal(test_user.id, "Active Goal")
    g2 = await service.create_goal(test_user.id, "Paused Goal")
    await service.update_goal_status(g2, "paused")
    active = await service.list_goals(test_user.id, status="active")
    assert len(active) == 1


@pytest.mark.asyncio
async def test_ownership_check(db_session, test_user):
    service = GoalService(db_session)
    goal = await service.create_goal(test_user.id, "Test")
    other_user_id = uuid.uuid4()
    result = await service.get_goal(goal.id, other_user_id)
    assert result is None


@pytest.mark.asyncio
async def test_milestone_crud(db_session, test_user):
    service = GoalService(db_session)
    goal = await service.create_goal(test_user.id, "Test Goal")
    await service.add_milestone(goal.id, "Step 1", sort_order=0)
    await service.add_milestone(goal.id, "Step 2", sort_order=1)
    ms_repo = MilestoneRepository(db_session)
    milestones = await ms_repo.list_by_goal(goal.id)
    assert len(milestones) == 2
    assert milestones[0].title == "Step 1"


@pytest.mark.asyncio
async def test_milestone_complete(db_session, test_user):
    service = GoalService(db_session)
    goal = await service.create_goal(test_user.id, "Test Goal")
    m1 = await service.add_milestone(goal.id, "Step 1")
    ms_repo = MilestoneRepository(db_session)
    m1_obj = await ms_repo.get(m1.id)
    completed = await ms_repo.complete(m1_obj)
    assert completed.status == "completed"
    assert completed.completed_at is not None


@pytest.mark.asyncio
async def test_progress_empty_milestones():
    assert GoalService.calculate_progress([]) == 0


@pytest.mark.asyncio
async def test_progress_calculation(db_session, test_user):
    service = GoalService(db_session)
    goal = await service.create_goal(test_user.id, "Test")
    await service.add_milestone(goal.id, "M1")
    await service.add_milestone(goal.id, "M2")
    m3 = await service.add_milestone(goal.id, "M3")
    ms_repo = MilestoneRepository(db_session)
    m3_obj = await ms_repo.get(m3.id)
    await ms_repo.complete(m3_obj)
    milestones = await ms_repo.list_by_goal(goal.id)
    assert service.calculate_progress(milestones) == 33


@pytest.mark.asyncio
async def test_complete_milestone_updates_progress(db_session, test_user):
    service = GoalService(db_session)
    goal = await service.create_goal(test_user.id, "Test")
    m1 = await service.add_milestone(goal.id, "M1")
    ms_repo = MilestoneRepository(db_session)
    m1_obj = await ms_repo.get(m1.id)
    milestone, updated_goal, suggest = await service.complete_milestone(m1_obj, goal)
    assert updated_goal.progress == 100
    assert suggest is True


@pytest.mark.asyncio
async def test_goal_delete_cascades(db_session, test_user):
    service = GoalService(db_session)
    goal = await service.create_goal(test_user.id, "Test Goal")
    await service.add_milestone(goal.id, "Step 1")
    await service.delete_goal(goal.id)
    ms_repo = MilestoneRepository(db_session)
    milestones = await ms_repo.list_by_goal(goal.id)
    assert len(milestones) == 0


@pytest.mark.asyncio
async def test_goal_summary(db_session, test_user):
    service = GoalService(db_session)
    await service.create_goal(test_user.id, "Goal 1")
    await service.create_goal(test_user.id, "Goal 2")
    summary = await service.get_summary(test_user.id)
    assert summary["total_goals"] == 2
    assert summary["active_goals"] == 2


@pytest.mark.asyncio
async def test_active_goals_context(db_session, test_user):
    service = GoalService(db_session)
    await service.create_goal(test_user.id, "Learn Python", category="learning")
    context = await service.get_active_goals_context(test_user.id)
    assert "Learn Python" in context
    assert "learning" in context


@pytest.mark.asyncio
async def test_active_goals_context_empty(db_session, test_user):
    service = GoalService(db_session)
    context = await service.get_active_goals_context(test_user.id)
    assert context == ""
