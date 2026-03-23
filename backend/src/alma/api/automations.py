import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.dependencies import get_current_user
from alma.database import get_session
from alma.domain.automation.service import AutomationService
from alma.infrastructure.llm.claude import ClaudeProvider
from alma.models.models import User

router = APIRouter(prefix="/api/automations", tags=["automations"])


class RuleCreate(BaseModel):
    name: str = Field(min_length=1)
    trigger_event: str
    trigger_condition: dict = Field(default_factory=dict)
    action_type: Literal["notification", "habit.checkin", "log"]
    action_config: dict = Field(default_factory=dict)
    description: str | None = None


class RuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    trigger_condition: dict | None = None
    action_config: dict | None = None
    description: str | None = None


class RuleResponse(BaseModel):
    id: str
    name: str
    description: str | None
    trigger_event: str
    trigger_condition: dict
    action_type: str
    action_config: dict
    confidence: float
    is_active: bool
    execution_count: int
    last_executed_at: str | None
    created_at: str


def _rule_response(rule) -> RuleResponse:
    return RuleResponse(
        id=str(rule.id),
        name=rule.name,
        description=rule.description,
        trigger_event=rule.trigger_event,
        trigger_condition=rule.trigger_condition or {},
        action_type=rule.action_type,
        action_config=rule.action_config or {},
        confidence=rule.confidence,
        is_active=rule.is_active,
        execution_count=rule.execution_count,
        last_executed_at=rule.last_executed_at.isoformat() if rule.last_executed_at else None,
        created_at=rule.created_at.isoformat(),
    )


@router.get("", response_model=list[RuleResponse])
async def list_rules(
    active_only: bool = True,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = AutomationService(session)
    rules = await service.list_rules(user.id, active_only)
    return [_rule_response(r) for r in rules]


@router.post("", response_model=RuleResponse, status_code=201)
async def create_rule(
    req: RuleCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = AutomationService(session)
    rule = await service.create_rule(
        user.id,
        req.name,
        req.trigger_event,
        req.action_type,
        req.action_config,
        trigger_condition=req.trigger_condition,
        description=req.description,
    )
    return _rule_response(rule)


@router.get("/{rule_id}", response_model=RuleResponse)
async def get_rule(
    rule_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = AutomationService(session)
    rule = await service.get_rule(uuid.UUID(rule_id), user.id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return _rule_response(rule)


@router.put("/{rule_id}", response_model=RuleResponse)
async def update_rule(
    rule_id: str,
    req: RuleUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = AutomationService(session)
    rule = await service.get_rule(uuid.UUID(rule_id), user.id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    updates = req.model_dump(exclude_none=True)
    rule = await service.update_rule(rule, **updates)
    return _rule_response(rule)


@router.delete("/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = AutomationService(session)
    rule = await service.get_rule(uuid.UUID(rule_id), user.id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    await service.delete_rule(rule.id)


@router.put("/{rule_id}/toggle", response_model=RuleResponse)
async def toggle_rule(
    rule_id: str,
    is_active: bool = True,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = AutomationService(session)
    rule = await service.toggle_rule(uuid.UUID(rule_id), user.id, is_active)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return _rule_response(rule)


@router.post("/suggest")
async def suggest_automations(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    llm = ClaudeProvider()
    service = AutomationService(session, llm=llm)
    suggestions = await service.suggest_automations(user.id)
    return {"suggestions": suggestions}
