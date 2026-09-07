import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from alma.api.llm import resolve_llm_router
from alma.auth.dependencies import get_current_user
from alma.database import get_session
from alma.domain.ontology.analyzer import GraphAnalyzer
from alma.domain.ontology.repository import InsightRepository
from alma.domain.ontology.service import OntologyService
from alma.models.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ontology/insights", tags=["ontology-insights"])


# --- Schemas ---


class InsightResponse(BaseModel):
    id: str
    insight_type: str
    title: str
    description: str
    evidence: dict
    confidence: float
    actionable: bool
    action_suggestion: str | None
    status: str
    created_at: str


class InsightSummaryResponse(BaseModel):
    total: int
    new_count: int
    by_type: dict[str, int]


class AnalysisResponse(BaseModel):
    analysis: dict
    insights: list[InsightResponse]
    llm_used: bool


class StatusUpdateRequest(BaseModel):
    status: str


# --- Helpers ---


def _insight_response(insight) -> InsightResponse:
    return InsightResponse(
        id=str(insight.id),
        insight_type=insight.insight_type,
        title=insight.title,
        description=insight.description,
        evidence=insight.evidence,
        confidence=insight.confidence,
        actionable=insight.actionable,
        action_suggestion=insight.action_suggestion,
        status=insight.status,
        created_at=insight.created_at.isoformat(),
    )


# --- Routes ---


@router.post("/generate", response_model=AnalysisResponse)
async def generate_insights(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = OntologyService(session, embedding_provider=None)
    graph_data = await service.get_full_graph(user.id)
    analyzer = GraphAnalyzer(graph_data)
    analysis = analyzer.full_analysis()

    llm_router = await resolve_llm_router(session, user.id)
    insights = []
    llm_used = False

    if llm_router:
        try:
            from alma.domain.ontology.insight_generator import InsightGenerator

            insight_repo = InsightRepository(session)
            generator = InsightGenerator(llm_router, insight_repo)
            insight_objs = await generator.generate(user.id, analysis)
            await session.commit()
            insights = [_insight_response(i) for i in insight_objs]
            llm_used = True
        except Exception:
            logger.warning("LLM insight generation failed, returning raw analysis", exc_info=True)

    return AnalysisResponse(analysis=analysis, insights=insights, llm_used=llm_used)


@router.get("", response_model=list[InsightResponse])
async def list_insights(
    insight_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = InsightRepository(session)
    insights = await repo.list_by_user(
        user.id, insight_type=insight_type, status=status, limit=limit
    )
    return [_insight_response(i) for i in insights]


@router.patch("/{insight_id}", response_model=InsightResponse)
async def update_insight_status(
    insight_id: str,
    req: StatusUpdateRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if req.status not in ("new", "read", "acted", "dismissed"):
        raise HTTPException(status_code=400, detail="Invalid status")

    repo = InsightRepository(session)
    insight = await repo.get(uuid.UUID(insight_id))
    if not insight or insight.user_id != user.id:
        raise HTTPException(status_code=404, detail="Insight not found")

    updated = await repo.update_status(uuid.UUID(insight_id), req.status)
    await session.commit()
    return _insight_response(updated)


@router.get("/summary", response_model=InsightSummaryResponse)
async def get_insight_summary(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = InsightRepository(session)
    summary = await repo.get_summary(user.id)
    return InsightSummaryResponse(**summary)
