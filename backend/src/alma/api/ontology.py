import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.dependencies import get_current_user
from alma.database import get_session
from alma.domain.ontology.models import NodeCandidate
from alma.domain.ontology.service import OntologyService
from alma.models.models import User

router = APIRouter(prefix="/api/ontology", tags=["ontology"])


# --- Schemas ---


class NodeResponse(BaseModel):
    id: str
    name: str
    type_name: str
    parent_category: str
    properties: dict
    status: str
    confidence: float


class EdgeResponse(BaseModel):
    id: str
    source_id: str
    target_id: str
    relation: str
    properties: dict
    confidence: float


class GraphResponse(BaseModel):
    nodes: list[NodeResponse]
    edges: list[EdgeResponse]


class GraphStats(BaseModel):
    total_nodes: int
    total_edges: int
    nodes_by_category: dict[str, int]
    draft_count: int
    avg_confidence: float


class ObjectTypeCreate(BaseModel):
    name: str = Field(min_length=1)
    parent_category: str = Field(min_length=1)
    description: str | None = None
    property_schema: dict = Field(default_factory=dict)


class LinkTypeCreate(BaseModel):
    name: str = Field(min_length=1)
    cardinality: str = "N:M"
    description: str | None = None


class ObjectTypeResponse(BaseModel):
    id: str
    name: str
    parent_category: str
    description: str | None
    property_schema: dict
    is_system: bool


class LinkTypeResponse(BaseModel):
    id: str
    name: str
    cardinality: str
    description: str | None
    is_system: bool


class TypesResponse(BaseModel):
    object_types: list[ObjectTypeResponse]
    link_types: list[LinkTypeResponse]


class MergeRequest(BaseModel):
    target_id: str


class ExtractPreviewRequest(BaseModel):
    text: str = Field(min_length=1)


class ExtractPreviewResponse(BaseModel):
    nodes: list[dict]
    edges: list[dict]


class ActionLogResponse(BaseModel):
    id: str
    action_type_id: str
    actor: str
    input_params: dict
    affected_objects: list
    status: str
    created_at: str


class NeighborNode(BaseModel):
    id: str
    name: str
    type_id: str
    depth: int


# --- Helpers ---


async def _get_llm_router():
    """Try to construct LLMRouter. Returns None if no API keys configured."""
    try:
        from alma.config import settings
        from alma.infrastructure.llm.router import LLMRouter

        providers: dict = {}
        if settings.anthropic_api_key:
            from alma.infrastructure.llm.claude import ClaudeProvider

            providers["claude"] = ClaudeProvider()
        if settings.openai_api_key:
            from alma.infrastructure.llm.openai_provider import OpenAIProvider

            providers["openai"] = OpenAIProvider()
        if providers:
            return LLMRouter(providers)
    except Exception:
        pass
    return None


def _node_response(obj, type_name: str = "", parent_category: str = "") -> NodeResponse:
    return NodeResponse(
        id=str(obj.id),
        name=obj.name,
        type_name=type_name,
        parent_category=parent_category,
        properties=obj.properties,
        status=obj.status,
        confidence=obj.confidence,
    )


def _edge_response(link, relation: str = "") -> EdgeResponse:
    return EdgeResponse(
        id=str(link.id),
        source_id=str(link.source_id),
        target_id=str(link.target_id),
        relation=relation,
        properties=link.properties,
        confidence=link.confidence,
    )


# --- Routes ---


@router.get("/types", response_model=TypesResponse)
async def list_types(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = OntologyService(session, embedding_provider=None)
    obj_types = await service.ot_repo.list_by_user(user.id)
    link_types = await service.lt_repo.list_by_user(user.id)
    return TypesResponse(
        object_types=[
            ObjectTypeResponse(
                id=str(t.id),
                name=t.name,
                parent_category=t.parent_category,
                description=t.description,
                property_schema=t.property_schema,
                is_system=t.is_system,
            )
            for t in obj_types
        ],
        link_types=[
            LinkTypeResponse(
                id=str(lt.id),
                name=lt.name,
                cardinality=lt.cardinality,
                description=lt.description,
                is_system=lt.is_system,
            )
            for lt in link_types
        ],
    )


@router.post("/types/objects", response_model=ObjectTypeResponse, status_code=201)
async def create_object_type(
    req: ObjectTypeCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = OntologyService(session, embedding_provider=None)
    existing = await service.ot_repo.get_by_name(user.id, req.name)
    if existing:
        raise HTTPException(status_code=409, detail="Object type already exists")
    ot = await service.ot_repo.create(
        user_id=user.id,
        name=req.name,
        parent_category=req.parent_category,
        description=req.description,
        property_schema=req.property_schema,
    )
    await session.commit()
    return ObjectTypeResponse(
        id=str(ot.id),
        name=ot.name,
        parent_category=ot.parent_category,
        description=ot.description,
        property_schema=ot.property_schema,
        is_system=ot.is_system,
    )


@router.post("/types/links", response_model=LinkTypeResponse, status_code=201)
async def create_link_type(
    req: LinkTypeCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = OntologyService(session, embedding_provider=None)
    existing = await service.lt_repo.get_by_name(user.id, req.name)
    if existing:
        raise HTTPException(status_code=409, detail="Link type already exists")
    lt = await service.lt_repo.create(
        user_id=user.id,
        name=req.name,
        cardinality=req.cardinality,
        description=req.description,
    )
    await session.commit()
    return LinkTypeResponse(
        id=str(lt.id),
        name=lt.name,
        cardinality=lt.cardinality,
        description=lt.description,
        is_system=lt.is_system,
    )


@router.get("/objects", response_model=list[NodeResponse])
async def list_objects(
    type_name: str | None = None,
    status: str | None = None,
    category: str | None = None,
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = OntologyService(session, embedding_provider=None)

    # Build type lookup (single query)
    all_types = await service.ot_repo.list_by_user(user.id)
    type_map: dict[uuid.UUID, tuple[str, str]] = {t.id: (t.name, t.parent_category) for t in all_types}

    type_id = None
    if type_name:
        ot = await service.ot_repo.get_by_name(user.id, type_name)
        if not ot:
            return []
        type_id = ot.id
    elif category:
        # category 필터: 해당 카테고리의 모든 type_ids 수집 → DB 레벨 필터링
        cat_type_ids = [tid for tid, (_, pcat) in type_map.items() if pcat == category]
        if not cat_type_ids:
            return []
        # type_id 필터 대신 여러 type_ids로 필터 — 첫 번째만 사용 (list_by_user는 단일 type_id)
        # 단순화: category에 해당하는 objects만 가져오기
        all_objects = []
        for tid in cat_type_ids:
            objs = await service.obj_repo.list_by_user(user.id, status=status, type_id=tid)
            all_objects.extend(objs)
        # 정렬 + offset/limit 적용
        all_objects.sort(key=lambda o: o.updated_at or o.created_at, reverse=True)
        paged = all_objects[offset:offset + limit]
        return [_node_response(obj, *type_map.get(obj.type_id, ("unknown", "unknown"))) for obj in paged]

    objects = await service.obj_repo.list_by_user(
        user.id, status=status, type_id=type_id, limit=limit, offset=offset,
    )

    return [_node_response(obj, *type_map.get(obj.type_id, ("unknown", "unknown"))) for obj in objects]


@router.get("/objects/{object_id}", response_model=NodeResponse)
async def get_object(
    object_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = OntologyService(session, embedding_provider=None)
    obj = await service.get_object(uuid.UUID(object_id))
    if not obj or obj.user_id != user.id:
        raise HTTPException(status_code=404, detail="Object not found")

    all_types = await service.ot_repo.list_by_user(user.id)
    type_name = "unknown"
    parent_category = "unknown"
    for t in all_types:
        if t.id == obj.type_id:
            type_name = t.name
            parent_category = t.parent_category
            break

    return _node_response(obj, type_name, parent_category)


@router.get("/objects/{object_id}/neighbors", response_model=list[NeighborNode])
async def get_neighbors(
    object_id: str,
    depth: int = Query(default=2, ge=1, le=5),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = OntologyService(session, embedding_provider=None)
    obj = await service.get_object(uuid.UUID(object_id))
    if not obj or obj.user_id != user.id:
        raise HTTPException(status_code=404, detail="Object not found")

    neighbors = await service.get_neighbors(uuid.UUID(object_id), depth=depth)
    return [
        NeighborNode(id=str(n.id), name=n.name, type_id=str(n.type_id), depth=n.depth)
        for n in neighbors
    ]


@router.post("/objects/{object_id}/verify", response_model=NodeResponse)
async def verify_object(
    object_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = OntologyService(session, embedding_provider=None)
    obj = await service.get_object(uuid.UUID(object_id))
    if not obj or obj.user_id != user.id:
        raise HTTPException(status_code=404, detail="Object not found")

    await service.verify_object(uuid.UUID(object_id))
    await session.commit()

    all_types = await service.ot_repo.list_by_user(user.id)
    type_name = "unknown"
    parent_category = "unknown"
    for t in all_types:
        if t.id == obj.type_id:
            type_name = t.name
            parent_category = t.parent_category
            break

    obj.status = "verified"
    return _node_response(obj, type_name, parent_category)


@router.post("/objects/{object_id}/merge")
async def merge_object(
    object_id: str,
    req: MergeRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = OntologyService(session, embedding_provider=None)
    source_obj = await service.get_object(uuid.UUID(object_id))
    if not source_obj or source_obj.user_id != user.id:
        raise HTTPException(status_code=404, detail="Source object not found")

    target_obj = await service.get_object(uuid.UUID(req.target_id))
    if not target_obj or target_obj.user_id != user.id:
        raise HTTPException(status_code=404, detail="Target object not found")

    candidate = NodeCandidate(
        name=source_obj.name,
        parent_category="",
        sub_type="",
        properties=source_obj.properties,
        confidence=source_obj.confidence,
        source_type=source_obj.source_type,
        source_id=source_obj.source_id,
    )
    await service.merge_object(uuid.UUID(req.target_id), candidate)
    await service.archive_object(uuid.UUID(object_id))
    await session.commit()

    return {"status": "merged", "target_id": req.target_id}


@router.delete("/objects/{object_id}", status_code=204)
async def archive_object(
    object_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = OntologyService(session, embedding_provider=None)
    obj = await service.get_object(uuid.UUID(object_id))
    if not obj or obj.user_id != user.id:
        raise HTTPException(status_code=404, detail="Object not found")

    await service.archive_object(uuid.UUID(object_id))
    await session.commit()


@router.get("/links", response_model=list[EdgeResponse])
async def list_links(
    limit: int = Query(default=100, le=500),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = OntologyService(session, embedding_provider=None)
    links = await service.link_repo.list_by_user(user.id, limit=limit)

    # Build link type lookup
    link_types = await service.lt_repo.list_by_user(user.id)
    lt_map = {lt.id: lt.name for lt in link_types}

    return [_edge_response(link, lt_map.get(link.type_id, "unknown")) for link in links]


@router.get("/graph", response_model=GraphResponse)
async def get_full_graph(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = OntologyService(session, embedding_provider=None)
    graph_data = await service.get_full_graph(user.id)

    # Build type lookups
    all_types = await service.ot_repo.list_by_user(user.id)
    type_map = {str(t.id): (t.name, t.parent_category) for t in all_types}
    link_types = await service.lt_repo.list_by_user(user.id)
    lt_map = {str(lt.id): lt.name for lt in link_types}

    nodes = []
    for n in graph_data.nodes:
        tname, pcat = type_map.get(n.get("type_id", ""), ("unknown", "unknown"))
        nodes.append(
            NodeResponse(
                id=n["id"],
                name=n["name"],
                type_name=tname,
                parent_category=pcat,
                properties=n.get("properties", {}),
                status="verified",
                confidence=n.get("confidence", 1.0),
            )
        )

    edges = []
    for e in graph_data.edges:
        relation = lt_map.get(e.get("type_id", ""), "unknown")
        edges.append(
            EdgeResponse(
                id=e["id"],
                source_id=e["source"],
                target_id=e["target"],
                relation=relation,
                properties=e.get("properties", {}),
                confidence=e.get("confidence", 1.0),
            )
        )

    return GraphResponse(nodes=nodes, edges=edges)


@router.post("/extract/preview", response_model=ExtractPreviewResponse)
async def extract_preview(
    req: ExtractPreviewRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    try:
        from alma.domain.ontology.extractor import SemanticExtractor

        service = OntologyService(session, embedding_provider=None)
        llm_router = await _get_llm_router()
        if not llm_router:
            raise HTTPException(
                status_code=503,
                detail="LLM extraction not available. Check LLM configuration.",
            )
        extractor = SemanticExtractor(llm_router, service)
        extraction = await extractor.extract(req.text, user.id)

        return ExtractPreviewResponse(
            nodes=[
                {
                    "name": n.name,
                    "parent_category": n.parent_category,
                    "sub_type": n.sub_type,
                    "properties": n.properties,
                    "confidence": n.confidence,
                }
                for n in extraction.node_candidates
            ],
            edges=[
                {
                    "source_name": e.source_name,
                    "target_name": e.target_name,
                    "relation": e.relation,
                    "properties": e.properties,
                    "confidence": e.confidence,
                }
                for e in extraction.edge_candidates
            ],
        )
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="LLM extraction not available. Check LLM configuration.",
        )


@router.get("/stats", response_model=GraphStats)
async def get_stats(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = OntologyService(session, embedding_provider=None)
    stats = await service.get_stats(user.id)
    return GraphStats(**stats)


@router.get("/actions/log", response_model=list[ActionLogResponse])
async def get_action_log(
    limit: int = Query(default=50, le=200),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = OntologyService(session, embedding_provider=None)
    logs = await service.al_repo.list_by_user(user.id, limit=limit)
    return [
        ActionLogResponse(
            id=str(log.id),
            action_type_id=str(log.action_type_id),
            actor=log.actor,
            input_params=log.input_params,
            affected_objects=log.affected_objects,
            status=log.status,
            created_at=log.created_at.isoformat(),
        )
        for log in logs
    ]
