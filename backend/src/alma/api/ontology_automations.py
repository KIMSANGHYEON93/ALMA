import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from alma.api.llm import resolve_llm_router
from alma.auth.dependencies import get_current_user
from alma.database import get_session
from alma.domain.ontology.action_executor import ActionExecutor
from alma.domain.ontology.action_planner import ActionPlanner
from alma.domain.ontology.repository import (
    AutomationLogRepository,
    AutomationRepository,
    InsightRepository,
)
from alma.domain.ontology.service import OntologyService
from alma.models.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ontology/automations", tags=["ontology-automations"])


# --- Schemas ---


class AutomationCreateRequest(BaseModel):
    name: str
    insight_type: str
    action_type: str
    config: dict = {}
    auto_execute: bool = False


class AutomationUpdateRequest(BaseModel):
    name: str | None = None
    insight_type: str | None = None
    action_type: str | None = None
    config: dict | None = None
    auto_execute: bool | None = None
    enabled: bool | None = None


class AutomationResponse(BaseModel):
    id: str
    name: str
    insight_type: str
    action_type: str
    config: dict
    auto_execute: bool
    enabled: bool
    created_at: str


class AutomationLogResponse(BaseModel):
    id: str
    automation_id: str
    insight_id: str | None
    action_taken: str
    result: dict
    status: str
    created_at: str


class ExecuteRequest(BaseModel):
    insight_id: str


class ExecuteResponse(BaseModel):
    results: list[dict]


# --- Helpers ---


def _automation_response(automation) -> AutomationResponse:
    return AutomationResponse(
        id=str(automation.id),
        name=automation.name,
        insight_type=automation.insight_type,
        action_type=automation.action_type,
        config=automation.config,
        auto_execute=automation.auto_execute,
        enabled=automation.enabled,
        created_at=automation.created_at.isoformat(),
    )


def _log_response(log) -> AutomationLogResponse:
    return AutomationLogResponse(
        id=str(log.id),
        automation_id=str(log.automation_id),
        insight_id=str(log.insight_id) if log.insight_id else None,
        action_taken=log.action_taken,
        result=log.result,
        status=log.status,
        created_at=log.created_at.isoformat(),
    )


# --- Routes ---


@router.get("", response_model=list[AutomationResponse])
async def list_automations(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = AutomationRepository(session)
    automations = await repo.list_by_user(user.id)
    return [_automation_response(a) for a in automations]


@router.post("", response_model=AutomationResponse)
async def create_automation(
    req: AutomationCreateRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    valid_insight_types = {
        "hub_node",
        "isolated",
        "strong_path",
        "conflict",
        "opportunity",
        "trend",
    }
    valid_action_types = {"create_link", "create_node", "notification", "suggest"}

    if req.insight_type not in valid_insight_types:
        raise HTTPException(status_code=400, detail=f"Invalid insight_type: {req.insight_type}")
    if req.action_type not in valid_action_types:
        raise HTTPException(status_code=400, detail=f"Invalid action_type: {req.action_type}")

    repo = AutomationRepository(session)
    automation = await repo.create(
        user_id=user.id,
        name=req.name,
        insight_type=req.insight_type,
        action_type=req.action_type,
        config=req.config,
        auto_execute=req.auto_execute,
    )
    await session.commit()
    return _automation_response(automation)


@router.patch("/{automation_id}", response_model=AutomationResponse)
async def update_automation(
    automation_id: str,
    req: AutomationUpdateRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = AutomationRepository(session)
    automation = await repo.get(uuid.UUID(automation_id))
    if not automation or automation.user_id != user.id:
        raise HTTPException(status_code=404, detail="Automation not found")

    update_data = req.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    updated = await repo.update(uuid.UUID(automation_id), **update_data)
    await session.commit()
    return _automation_response(updated)


@router.delete("/{automation_id}")
async def delete_automation(
    automation_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = AutomationRepository(session)
    automation = await repo.get(uuid.UUID(automation_id))
    if not automation or automation.user_id != user.id:
        raise HTTPException(status_code=404, detail="Automation not found")

    await repo.delete(uuid.UUID(automation_id))
    await session.commit()
    return {"detail": "deleted"}


@router.post("/execute", response_model=ExecuteResponse)
async def execute_automations(
    req: ExecuteRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    insight_repo = InsightRepository(session)
    insight = await insight_repo.get(uuid.UUID(req.insight_id))
    if not insight or insight.user_id != user.id:
        raise HTTPException(status_code=404, detail="Insight not found")

    auto_repo = AutomationRepository(session)
    rules = await auto_repo.find_by_insight_type(user.id, insight.insight_type)
    if not rules:
        return ExecuteResponse(results=[])

    llm_router = await resolve_llm_router(session, user.id)
    planner = ActionPlanner(llm_router)
    service = OntologyService(session, embedding_provider=None)
    log_repo = AutomationLogRepository(session)
    executor = ActionExecutor(service, log_repo, insight_repo)

    results = []
    for rule in rules:
        plan = await planner.plan(insight, rule)
        if plan:
            result = await executor.execute(plan, rule.id, insight.id, user.id)
            results.append(result)

    await session.commit()
    return ExecuteResponse(results=results)


@router.get("/logs", response_model=list[AutomationLogResponse])
async def list_automation_logs(
    limit: int = Query(default=50, le=200),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    log_repo = AutomationLogRepository(session)
    logs = await log_repo.list_by_user(user.id, limit=limit)
    return [_log_response(log) for log in logs]
