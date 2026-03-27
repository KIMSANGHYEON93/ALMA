# Phase A: Ontology Core — 의미 추출 + 지식 그래프 + 정제 파이프라인

## 1. 개요

ALMA의 중심 데이터 구조를 온톨로지로 재설계한다. 모든 사용자 입력(채팅, 목표, 습관, 문서)에서 LLM이 의미를 추출하고, 정제 파이프라인을 거쳐 검증된 노드/엣지만 온톨로지에 저장한다. 기존 9개 바운디드 컨텍스트는 도메인 어댑터를 통해 온톨로지와 양방향 싱크한다.

**설계 원칙 (팔란티어 3원칙 + 제1원칙):**
1. **스키마 선행** — Object/Link Type을 먼저 정의, 데이터는 틀에 맞춰야 진입
2. **정제 게이트** — 중복 제거/검증을 통과해야만 온톨로지에 도달
3. **Action 로깅** — 모든 온톨로지 변경은 Action으로 기록 (감사 추적)
4. **PostgreSQL 순수 구현** — 기존 Supabase 인프라 유지, nodes/edges + Recursive CTE

**접근법:** 온톨로지 코어 + 도메인 어댑터
- 온톨로지 = 단일 진실 원천 (Single Source of Truth) for 의미와 관계
- 기존 테이블 = backing dataset for 관계형 CRUD (목록, 필터, 페이징)
- 어댑터 = 양방향 싱크 레이어

**범위:**
- 온톨로지 코어 테이블 (object_types, objects, link_types, links, action_types, action_logs)
- Semantic Extractor (LLM 의미 추출)
- Purification Pipeline (정제 게이트 4단계)
- 도메인 어댑터 (Goal, Habit, Memory, Chat, Knowledge)
- 시스템 기본 스키마 시딩
- REST API 엔드포인트
- 프론트엔드 온톨로지 관리 페이지 (기본)

**범위 외:** 그래프 시각화 UI (Phase B), 패턴 추론/예측 (Phase C), 에이전트 워크플로우/MCP 자율화 (Phase D)

---

## 2. 아키텍처

```
사용자 입력 (채팅/목표/습관/문서/수동)
    |
    v
[Domain Event Bus] ──> [Domain Adapters]
    |                        |
    v                        v
[SemanticExtractor]    [Direct Mapping]
  (LLM 의미 추출)       (시스템 이벤트, confidence=1.0)
    |                        |
    +────────┬───────────────+
             v
[PurificationPipeline]
  Stage 1: Deduplication (임베딩 유사도)
  Stage 2: Schema Validation (타입/속성 검증)
  Stage 3: Normalization (속성 정규화)
  Stage 4: Confidence Gate (신뢰도 분류)
             |
             v
[Ontology Core]
  object_types / objects / link_types / links
  action_types / ontology_action_logs
             |
             v
[REST API] ──> Frontend / Phase B 시각화 / Phase C 추론
```

---

## 3. 데이터 모델

### 3.1 object_types (노드 스키마)

```python
class ObjectType(Base):
    __tablename__ = "ontology_object_types"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(nullable=False)
    parent_category: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    schema: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    embedding = mapped_column(Vector(768), nullable=True)
    is_system: Mapped[bool] = mapped_column(default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_object_types_user_name"),
        Index("idx_object_types_user", "user_id", "parent_category"),
        Index(
            "idx_object_types_embedding", "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        CheckConstraint(
            "parent_category IN ('Entity','Action','Concept','Attribute','Temporal')",
            name="ck_object_types_category",
        ),
    )
```

### 3.2 objects (노드 인스턴스)

```python
class OntologyObject(Base):
    __tablename__ = "ontology_objects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ontology_object_types.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(nullable=False)
    properties: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    source_type: Mapped[str] = mapped_column(nullable=False)
    source_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    embedding = mapped_column(Vector(768), nullable=True)
    confidence: Mapped[float] = mapped_column(default=1.0)
    status: Mapped[str] = mapped_column(nullable=False, default="draft")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_objects_user_type", "user_id", "type_id"),
        Index("idx_objects_user_status", "user_id", "status"),
        Index("idx_objects_source", "source_type", "source_id"),
        Index(
            "idx_objects_embedding", "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        CheckConstraint(
            "source_type IN ('chat','goal','habit','memory','knowledge','manual','llm_extracted')",
            name="ck_objects_source_type",
        ),
        CheckConstraint(
            "status IN ('draft','verified','merged','archived')",
            name="ck_objects_status",
        ),
        CheckConstraint(
            "confidence >= 0 AND confidence <= 1",
            name="ck_objects_confidence",
        ),
    )
```

### 3.3 link_types (관계 스키마)

```python
class LinkType(Base):
    __tablename__ = "ontology_link_types"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(nullable=False)
    source_type_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("ontology_object_types.id", ondelete="RESTRICT"), nullable=True
    )
    target_type_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("ontology_object_types.id", ondelete="RESTRICT"), nullable=True
    )
    cardinality: Mapped[str] = mapped_column(nullable=False, default="N:M")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_system: Mapped[bool] = mapped_column(default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_link_types_user_name"),
        Index("idx_link_types_user", "user_id"),
        CheckConstraint(
            "cardinality IN ('1:1','1:N','N:M')",
            name="ck_link_types_cardinality",
        ),
    )
```

### 3.4 links (관계 인스턴스)

```python
class OntologyLink(Base):
    __tablename__ = "ontology_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ontology_link_types.id", ondelete="RESTRICT"), nullable=False
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ontology_objects.id", ondelete="CASCADE"), nullable=False
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ontology_objects.id", ondelete="CASCADE"), nullable=False
    )
    properties: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    confidence: Mapped[float] = mapped_column(default=1.0)
    source_origin: Mapped[str] = mapped_column(nullable=False, default="system")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_links_source", "source_id"),
        Index("idx_links_target", "target_id"),
        Index("idx_links_user_type", "user_id", "type_id"),
        UniqueConstraint("type_id", "source_id", "target_id", name="uq_links_type_source_target"),
        CheckConstraint(
            "confidence >= 0 AND confidence <= 1",
            name="ck_links_confidence",
        ),
        CheckConstraint(
            "source_origin IN ('llm','system','manual')",
            name="ck_links_source_origin",
        ),
        CheckConstraint(
            "source_id != target_id",
            name="ck_links_no_self_ref",
        ),
    )
```

### 3.5 ontology_action_types (행위 스키마)

```python
class OntologyActionType(Base):
    __tablename__ = "ontology_action_types"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(nullable=False)
    target_type_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("ontology_object_types.id", ondelete="SET NULL"), nullable=True
    )
    param_schema: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    side_effects: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    permissions: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    is_system: Mapped[bool] = mapped_column(default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_action_types_user_name"),
        Index("idx_action_types_user", "user_id"),
    )
```

### 3.6 ontology_action_logs (실행 이력)

```python
class OntologyActionLog(Base):
    __tablename__ = "ontology_action_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action_type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ontology_action_types.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    actor: Mapped[str] = mapped_column(nullable=False)
    input_params: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    result: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    affected_objects: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")
    status: Mapped[str] = mapped_column(nullable=False, default="success")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        Index("idx_onto_action_logs_user", "user_id", "created_at"),
        Index("idx_onto_action_logs_type", "action_type_id"),
        CheckConstraint(
            "actor IN ('user','agent','system','adapter')",
            name="ck_onto_action_logs_actor",
        ),
        CheckConstraint(
            "status IN ('success','failed','rolled_back')",
            name="ck_onto_action_logs_status",
        ),
    )
```

---

## 4. Semantic Extractor (LLM 의미 추출)

### 4.1 추출 프롬프트

```python
EXTRACTION_SYSTEM_PROMPT = """
당신은 텍스트에서 구조화된 지식을 추출하는 전문가입니다.

## 상위 카테고리
- Entity: 존재하는 것 (사람, 프로젝트, 조직)
- Action: 행위/목표 (목표, 습관, 태스크)
- Concept: 추상 개념 (주제, 기술, 가치)
- Attribute: 측정 가능한 속성 (메트릭, 감정)
- Temporal: 시간 기반 (이벤트, 기간)

## 규칙
1. 모호한 추출보다 누락이 낫다 (confidence < 0.5면 제외)
2. 기존 노드/관계 타입이 있으면 반드시 재사용
3. 새 타입 생성은 기존 타입으로 표현 불가능할 때만
4. 관계는 방향성이 있다 (source → relation → target)
5. 한국어 입력이면 노드 이름도 한국어로

## 출력 형식 (JSON)
{
  "nodes": [
    {
      "name": "노드 이름",
      "parent_category": "Entity|Action|Concept|Attribute|Temporal",
      "sub_type": "하위 타입 (기존 타입 우선 사용)",
      "properties": {"key": "value"},
      "confidence": 0.0-1.0
    }
  ],
  "edges": [
    {
      "source_name": "시작 노드 이름",
      "target_name": "끝 노드 이름",
      "relation": "관계 타입 (기존 타입 우선 사용)",
      "properties": {"key": "value"},
      "confidence": 0.0-1.0
    }
  ]
}
"""
```

### 4.2 SemanticExtractor 서비스

```python
from alma.infrastructure.llm.base import LLMRequest, ChatMessage
from alma.infrastructure.llm.router import LLMRouter

class SemanticExtractor:
    def __init__(self, llm_router: LLMRouter, ontology_service: OntologyService):
        self.llm_router = llm_router
        self.ontology_service = ontology_service

    async def extract(self, text: str, user_id: uuid.UUID) -> RawExtraction:
        # 1. 기존 스키마 컨텍스트 로드
        context = await self.ontology_service.get_user_schema_context(user_id)

        # 2. LLM 호출 (기존 LLMRouter.complete() 인터페이스 사용)
        user_prompt = f"""
기존 Object Types: {context.object_type_names}
기존 Link Types: {context.link_type_names}
최근 노드 (참고용): {context.recent_node_names[:20]}

---
추출할 텍스트:
{text}

반드시 JSON 형식으로만 응답하세요.
"""
        request = LLMRequest(
            messages=[ChatMessage(role="user", content=user_prompt)],
            system_prompt=EXTRACTION_SYSTEM_PROMPT,
            max_tokens=2048,
            temperature=0.3,  # 추출은 낮은 temperature로 일관성 확보
        )
        response = await self.llm_router.complete(request)

        # 3. 파싱 + 임베딩 생성
        parsed = RawExtraction.from_llm_response(response.content)
        for node in parsed.node_candidates:
            node.embedding = await self.ontology_service.generate_embedding(
                f"{node.name} {node.sub_type} {json.dumps(node.properties)}"
            )
        return parsed
```

---

## 5. Purification Pipeline (정제 파이프라인)

### 5.1 파이프라인 구조

```python
@dataclass
class NodeCandidate:
    name: str
    parent_category: str
    sub_type: str
    properties: dict
    confidence: float
    embedding: list[float] | None = None
    source_type: str = "llm_extracted"
    source_id: uuid.UUID | None = None
    # 파이프라인 결과
    action: str = "create"  # "create"|"merge"|"review"|"reject"
    merge_target_id: uuid.UUID | None = None
    status: str = "draft"   # "draft"|"verified"|"rejected"

@dataclass
class EdgeCandidate:
    source_name: str
    target_name: str
    relation: str
    properties: dict
    confidence: float
    source_origin: str = "llm"

@dataclass
class RawExtraction:
    node_candidates: list[NodeCandidate]
    edge_candidates: list[EdgeCandidate]

@dataclass
class PurificationResult:
    created_objects: list[uuid.UUID]
    merged_objects: list[tuple[uuid.UUID, uuid.UUID]]  # (candidate, target)
    review_objects: list[uuid.UUID]  # draft 상태, 사용자 확인 필요
    rejected_count: int
    created_links: list[uuid.UUID]
```

### 5.2 파이프라인 실행

```python
class PurificationPipeline:
    def __init__(
        self,
        dedup_service: DeduplicationService,
        schema_validator: SchemaValidator,
        ontology_service: OntologyService,
    ):
        self.dedup = dedup_service
        self.validator = schema_validator
        self.ontology = ontology_service

    async def process(self, extraction: RawExtraction, user_id: uuid.UUID) -> PurificationResult:
        result = PurificationResult([], [], [], 0, [])

        # === Stage 1: Deduplication ===
        for candidate in extraction.node_candidates:
            if candidate.embedding:
                similar = await self.dedup.find_similar(
                    user_id, candidate.embedding, threshold=0.92
                )
                if similar and similar.similarity > 0.98:
                    candidate.action = "merge"
                    candidate.merge_target_id = similar.object_id
                elif similar:
                    candidate.action = "review"

        # === Stage 2: Schema Validation ===
        for candidate in extraction.node_candidates:
            if candidate.action == "reject":
                continue
            type_exists = await self.validator.validate_type(
                user_id, candidate.parent_category, candidate.sub_type
            )
            if not type_exists:
                # 새 하위 타입 자동 생성 (상위 카테고리가 유효하면)
                await self.ontology.create_object_type(
                    user_id=user_id,
                    name=candidate.sub_type,
                    parent_category=candidate.parent_category,
                    schema=self.validator.infer_schema(candidate.properties),
                    is_system=False,
                )
            prop_valid = self.validator.validate_properties(candidate)
            if not prop_valid:
                candidate.action = "reject"

        # === Stage 3: Normalization ===
        for candidate in extraction.node_candidates:
            if candidate.action == "reject":
                continue
            candidate.properties = self.validator.normalize(candidate.properties)

        # === Stage 4: Confidence Gate ===
        for candidate in extraction.node_candidates:
            if candidate.action == "reject":
                result.rejected_count += 1
                continue
            if candidate.confidence >= 0.8 and candidate.action == "create":
                candidate.status = "verified"
            elif candidate.confidence < 0.5:
                candidate.action = "reject"
                result.rejected_count += 1
                continue
            else:
                candidate.status = "draft"

        # === Persist ===
        for candidate in extraction.node_candidates:
            if candidate.action == "merge":
                await self.ontology.merge_object(candidate.merge_target_id, candidate)
                result.merged_objects.append((candidate.name, candidate.merge_target_id))
            elif candidate.action == "create" or candidate.action == "review":
                obj_id = await self.ontology.create_object(user_id, candidate)
                if candidate.status == "draft":
                    result.review_objects.append(obj_id)
                else:
                    result.created_objects.append(obj_id)

        # === Edge Processing ===
        for edge in extraction.edge_candidates:
            if edge.confidence < 0.5:
                continue
            source_obj = await self.ontology.find_object_by_name(user_id, edge.source_name)
            target_obj = await self.ontology.find_object_by_name(user_id, edge.target_name)
            if source_obj and target_obj:
                link_id = await self.ontology.create_link(
                    user_id, edge.relation, source_obj.id, target_obj.id,
                    edge.properties, edge.confidence, edge.source_origin
                )
                result.created_links.append(link_id)

        return result
```

---

## 6. Domain Adapters (도메인 어댑터)

### 6.1 Base Adapter Protocol

어댑터는 기존 이벤트 버스의 `DomainEvent`를 직접 받는다. `DomainEvent.payload: dict`에서 필요한 데이터를 추출한다.

```python
from alma.core.events.models import DomainEvent

class DomainAdapter:
    """도메인 이벤트 → 온톨로지 싱크 베이스 클래스"""

    def __init__(self, pipeline: PurificationPipeline, ontology: OntologyService):
        self.pipeline = pipeline
        self.ontology = ontology

    async def handle(self, event: DomainEvent) -> None:
        """이벤트 타입에 따라 적절한 핸들러로 라우팅"""
        raise NotImplementedError
```

### 6.2 GoalAdapter

```python
class GoalAdapter(DomainAdapter):
    async def handle(self, event: DomainEvent) -> None:
        """goal.created, goal.updated, goal.deleted 이벤트 처리"""
        p = event.payload
        user_id = uuid.UUID(event.user_id)

        if event.event_type == "goal.created":
            extraction = RawExtraction(
                node_candidates=[
                    NodeCandidate(
                        name=p["title"],
                        parent_category="Action",
                        sub_type="Goal",
                        properties={k: v for k, v in p.items() if k != "goal_id"},
                        confidence=1.0,  # 시스템 생성 = 최대 신뢰도
                        source_type="goal",
                        source_id=uuid.UUID(p["goal_id"]),
                    )
                ],
                edge_candidates=[],
            )
            await self.pipeline.process(extraction, user_id)

        elif event.event_type == "goal.updated":
            obj = await self.ontology.find_by_source("goal", uuid.UUID(p["goal_id"]))
            if obj:
                await self.ontology.update_object_properties(obj.id, p.get("changed", {}))

        elif event.event_type == "goal.deleted":
            obj = await self.ontology.find_by_source("goal", uuid.UUID(p["goal_id"]))
            if obj:
                await self.ontology.archive_object(obj.id)
```

> **Note**: 현재 GoalService는 `goal.created`만 발행 중. `goal.updated`, `goal.deleted` 이벤트 발행을 GoalService에 추가해야 함 (Backend - Modify 참조).

### 6.3 HabitAdapter

```python
class HabitAdapter(DomainAdapter):
    async def handle(self, event: DomainEvent) -> None:
        """habit.created, habit.deleted 이벤트 처리"""
        p = event.payload
        user_id = uuid.UUID(event.user_id)

        if event.event_type == "habit.created":
            extraction = RawExtraction(
                node_candidates=[
                    NodeCandidate(
                        name=p["title"],
                        parent_category="Action",
                        sub_type="Habit",
                        properties={
                            "frequency": p.get("frequency_type"),
                        },
                        confidence=1.0,
                        source_type="habit",
                        source_id=uuid.UUID(p["habit_id"]),
                    )
                ],
                edge_candidates=[],
            )
            # Habit에 goal_id가 있으면 "supports" 관계 추가
            goal_id = p.get("goal_id")
            if goal_id:
                goal_obj = await self.ontology.find_by_source("goal", uuid.UUID(goal_id))
                if goal_obj:
                    # goal_obj가 존재할 때만 엣지 추가 (빈 target_name 방지)
                    extraction.edge_candidates.append(
                        EdgeCandidate(
                            source_name=p["title"],
                            target_name=goal_obj.name,
                            relation="supports",
                            properties={},
                            confidence=1.0,
                            source_origin="system",
                        )
                    )

            await self.pipeline.process(extraction, user_id)

        elif event.event_type == "habit.deleted":
            obj = await self.ontology.find_by_source("habit", uuid.UUID(p["habit_id"]))
            if obj:
                await self.ontology.archive_object(obj.id)
```

### 6.4 ChatAdapter

```python
# 의미 추출 가치가 낮은 패턴 (LLM 호출 비용 절감)
SKIP_PATTERNS = re.compile(
    r'^(네|예|아니요|알겠|좋아|감사|ㅇㅇ|ㅋ|ㅎ|ok|yes|no|thanks|sure)',
    re.IGNORECASE
)
MIN_CONTENT_LENGTH = 30  # 최소 30자 (20자는 너무 짧음)

class ChatAdapter:
    def __init__(self, extractor: SemanticExtractor, pipeline: PurificationPipeline):
        self.extractor = extractor
        self.pipeline = pipeline

    async def handle(self, event: DomainEvent) -> None:
        """message.received 이벤트 처리"""
        p = event.payload

        # 사용자 메시지만 처리 (assistant 메시지는 무시)
        if p.get("role") != "user":
            return

        content = p.get("content", "")

        # 비용 절감 필터: 짧은 메시지, 확인형 메시지 스킵
        if len(content) < MIN_CONTENT_LENGTH:
            return
        if SKIP_PATTERNS.match(content.strip()):
            return

        # LLM 의미 추출 → 파이프라인
        user_id = uuid.UUID(event.user_id)
        extraction = await self.extractor.extract(content, user_id)
        if extraction.node_candidates or extraction.edge_candidates:
            await self.pipeline.process(extraction, user_id)
```

### 6.5 MemoryAdapter, KnowledgeAdapter

```python
class MemoryAdapter(DomainAdapter):
    async def handle(self, event: DomainEvent) -> None:
        """memory.created 이벤트 처리"""
        p = event.payload
        user_id = uuid.UUID(event.user_id)
        extraction = RawExtraction(
            node_candidates=[
                NodeCandidate(
                    name=p["content"][:100],
                    parent_category="Concept",
                    sub_type=p.get("category", "fact"),
                    properties={"full_content": p["content"]},
                    confidence=0.9,
                    source_type="memory",
                    source_id=uuid.UUID(p["memory_id"]) if p.get("memory_id") else None,
                )
            ],
            edge_candidates=[],
        )
        await self.pipeline.process(extraction, user_id)

class KnowledgeAdapter:
    def __init__(self, extractor: SemanticExtractor, pipeline: PurificationPipeline):
        self.extractor = extractor
        self.pipeline = pipeline

    async def handle(self, event: DomainEvent) -> None:
        """knowledge.document_ready 이벤트 처리"""
        p = event.payload
        user_id = uuid.UUID(event.user_id)
        extraction = await self.extractor.extract(
            f"문서: {p['title']}\n{p.get('content', '')[:2000]}",
            user_id,
        )
        for node in extraction.node_candidates:
            node.source_type = "knowledge"
            node.source_id = uuid.UUID(p["document_id"])
        await self.pipeline.process(extraction, user_id)
```

---

## 7. 시스템 기본 스키마 시딩

```python
SYSTEM_OBJECT_TYPES = [
    # Entity
    {"name": "Person", "parent": "Entity", "schema": {"role": "str"}},
    {"name": "Project", "parent": "Entity", "schema": {"status": "str", "deadline": "date"}},
    {"name": "Organization", "parent": "Entity", "schema": {"domain": "str"}},
    # Action
    {"name": "Goal", "parent": "Action", "schema": {"category": "str", "progress": "int", "target_date": "date"}},
    {"name": "Habit", "parent": "Action", "schema": {"frequency": "str", "streak": "int"}},
    {"name": "Task", "parent": "Action", "schema": {"priority": "str", "due_date": "date", "status": "str"}},
    # Concept
    {"name": "Topic", "parent": "Concept", "schema": {"domain": "str"}},
    {"name": "Skill", "parent": "Concept", "schema": {"level": "str"}},
    {"name": "Value", "parent": "Concept", "schema": {"importance": "float"}},
    # Attribute
    {"name": "Metric", "parent": "Attribute", "schema": {"unit": "str", "value": "float"}},
    {"name": "Emotion", "parent": "Attribute", "schema": {"intensity": "float"}},
    # Temporal
    {"name": "Event", "parent": "Temporal", "schema": {"start": "datetime", "end": "datetime"}},
    {"name": "Period", "parent": "Temporal", "schema": {"start": "date", "end": "date"}},
]

SYSTEM_LINK_TYPES = [
    {"name": "supports", "cardinality": "N:M", "desc": "A가 B를 지원/촉진"},
    {"name": "blocks", "cardinality": "N:M", "desc": "A가 B를 방해"},
    {"name": "causes", "cardinality": "N:M", "desc": "A가 B를 유발"},
    {"name": "part_of", "cardinality": "N:1", "desc": "A는 B의 일부"},
    {"name": "related_to", "cardinality": "N:M", "desc": "A와 B는 관련"},
    {"name": "depends_on", "cardinality": "N:M", "desc": "A는 B에 의존"},
    {"name": "measured_by", "cardinality": "N:M", "desc": "A는 B로 측정"},
    {"name": "belongs_to", "cardinality": "N:1", "desc": "A는 B에 소속"},
    {"name": "precedes", "cardinality": "N:M", "desc": "A가 B보다 먼저"},
    {"name": "contradicts", "cardinality": "N:M", "desc": "A와 B는 상충"},
]

SYSTEM_ACTION_TYPES = [
    {"name": "create_object", "desc": "노드 생성"},
    {"name": "update_object", "desc": "노드 속성 수정"},
    {"name": "archive_object", "desc": "노드 아카이브"},
    {"name": "merge_objects", "desc": "중복 노드 병합"},
    {"name": "create_link", "desc": "관계 생성"},
    {"name": "remove_link", "desc": "관계 제거"},
    {"name": "verify_object", "desc": "draft → verified 승인"},
]
```

시딩은 사용자 최초 가입 시 또는 마이그레이션에서 실행. `is_system=True`로 표시하여 사용자 삭제 방지.

### 7.1 SchemaValidator 상세

```python
class SchemaValidator:
    """JSONB 속성을 object_type.schema 정의에 따라 검증/정규화"""

    # 지원 타입 매핑
    TYPE_MAP = {"str": str, "int": int, "float": float, "bool": bool, "date": str, "datetime": str}

    def validate_type(self, user_id: UUID, parent_category: str, sub_type: str) -> bool:
        """상위 카테고리 유효성 + object_type 존재 여부 확인"""
        valid_categories = {"Entity", "Action", "Concept", "Attribute", "Temporal"}
        return parent_category in valid_categories

    def validate_properties(self, candidate: NodeCandidate) -> bool:
        """속성 값이 스키마 타입과 일치하는지 검증 (느슨한 검증: 추가 키 허용, 타입 불일치만 거부)"""
        # object_type.schema에 정의된 키의 값 타입만 검증
        # 스키마에 없는 추가 키는 허용 (유연한 동적 생성 지원)
        return True  # 타입 불일치 시에만 False

    def normalize(self, properties: dict) -> dict:
        """속성 값 정규화: 날짜 형식 통일, 문자열 trim, None 제거"""
        return {k: v for k, v in properties.items() if v is not None}

    def infer_schema(self, properties: dict) -> dict:
        """속성에서 스키마 추론 (새 object_type 자동 생성 시 사용)"""
        return {k: type(v).__name__ for k, v in properties.items() if v is not None}
```

### 7.2 설정값 (config.py 추가)

```python
# Deduplication thresholds (하드코딩 대신 설정으로 외부화)
ONTOLOGY_DEDUP_AUTO_MERGE_THRESHOLD: float = 0.98
ONTOLOGY_DEDUP_REVIEW_THRESHOLD: float = 0.92
ONTOLOGY_CONFIDENCE_AUTO_VERIFY: float = 0.8
ONTOLOGY_CONFIDENCE_REJECT: float = 0.5
ONTOLOGY_CHAT_MIN_LENGTH: int = 30
```

---

## 8. OntologyService (코어 서비스)

```python
class OntologyService:
    def __init__(self, session: AsyncSession, embedding_provider: EmbeddingProvider):
        self.session = session
        self.embedding = embedding_provider

    # === Schema Context (LLM 컨텍스트 주입용) ===
    async def get_user_schema_context(self, user_id: UUID) -> SchemaContext:
        types = await self.repo.list_object_types(user_id)
        link_types = await self.repo.list_link_types(user_id)
        recent = await self.repo.list_recent_objects(user_id, limit=20)
        return SchemaContext(
            object_type_names=[t.name for t in types],
            link_type_names=[lt.name for lt in link_types],
            recent_node_names=[o.name for o in recent],
        )

    # === Graph Query (Recursive CTE with cycle detection) ===
    async def get_neighbors(self, object_id: UUID, depth: int = 2) -> list[GraphNode]:
        """N홉 이웃 노드 조회 — Recursive CTE (PG14+ CYCLE 절로 순환 방지)"""
        query = text("""
            WITH RECURSIVE graph AS (
                -- Base: 시작 노드
                SELECT o.id, o.name, o.type_id, 0 AS depth
                FROM ontology_objects o
                WHERE o.id = :start_id

                UNION ALL

                -- Recursive: 이웃 탐색
                SELECT o2.id, o2.name, o2.type_id, g.depth + 1
                FROM graph g
                JOIN ontology_links l ON (l.source_id = g.id OR l.target_id = g.id)
                JOIN ontology_objects o2 ON (
                    o2.id = CASE WHEN l.source_id = g.id THEN l.target_id ELSE l.source_id END
                )
                WHERE g.depth < :max_depth
                  AND o2.status = 'verified'
            ) CYCLE id SET is_cycle USING path
            SELECT DISTINCT id, name, type_id, depth FROM graph WHERE NOT is_cycle ORDER BY depth
        """)
        result = await self.session.execute(query, {"start_id": object_id, "max_depth": depth})
        return [GraphNode(**row._mapping) for row in result]

    # === Full Graph (시각화용) ===
    async def get_full_graph(self, user_id: UUID) -> GraphData:
        """시각화용 전체 그래프 데이터"""
        objects = await self.repo.list_objects(user_id, status="verified")
        links = await self.repo.list_links(user_id)
        return GraphData(
            nodes=[{"id": str(o.id), "name": o.name, "type": o.type_id, "properties": o.properties} for o in objects],
            edges=[{"source": str(l.source_id), "target": str(l.target_id), "type": str(l.type_id), "properties": l.properties} for l in links],
        )

    # === Object CRUD (변경 시 Action 로그 기록) ===
    async def create_object(self, user_id: UUID, candidate: NodeCandidate) -> UUID:
        type_obj = await self.repo.get_object_type_by_name(user_id, candidate.sub_type)
        obj = OntologyObject(
            user_id=user_id,
            type_id=type_obj.id,
            name=candidate.name,
            properties=candidate.properties,
            source_type=candidate.source_type,
            source_id=candidate.source_id,
            embedding=candidate.embedding,
            confidence=candidate.confidence,
            status=candidate.status,
        )
        self.session.add(obj)
        await self.session.flush()

        # Action 로그 기록
        await self._log_action("create_object", user_id, "system", {"name": candidate.name}, str(obj.id))
        return obj.id

    async def merge_object(self, target_id: UUID, candidate: NodeCandidate):
        """기존 노드에 새 정보 병합 — 기존 값 우선 전략"""
        target = await self.repo.get_object(target_id)
        # 병합 전략: 기존 값 우선, 새 키만 추가 (기존 데이터 보호)
        # 기존에 없는 키만 candidate에서 가져옴
        merged_props = {**candidate.properties, **target.properties}
        target.properties = merged_props
        target.updated_at = func.now()
        # confidence는 더 높은 쪽으로
        if candidate.confidence > target.confidence:
            target.confidence = candidate.confidence
        await self._log_action("merge_objects", target.user_id, "system",
                               {"merged_from": candidate.name, "new_keys": list(
                                   set(candidate.properties) - set(target.properties)
                               )}, str(target_id))

    async def find_by_source(self, source_type: str, source_id: UUID) -> OntologyObject | None:
        return await self.repo.find_by_source(source_type, source_id)

    async def generate_embedding(self, text: str) -> list[float] | None:
        return await self.embedding.embed(text)
```

---

## 9. API Endpoints

### 9.1 라우터

| 엔드포인트 | 메서드 | 설명 |
|---|---|---|
| `GET /api/ontology/types` | GET | Object/Link Type 목록 |
| `POST /api/ontology/types/objects` | POST | 커스텀 Object Type 생성 |
| `POST /api/ontology/types/links` | POST | 커스텀 Link Type 생성 |
| `GET /api/ontology/objects` | GET | 노드 목록 (필터: type, status, category) |
| `GET /api/ontology/objects/{id}` | GET | 노드 상세 + 연결된 엣지 |
| `GET /api/ontology/objects/{id}/neighbors` | GET | N홉 이웃 (depth 파라미터) |
| `POST /api/ontology/objects/{id}/verify` | POST | draft → verified |
| `POST /api/ontology/objects/{id}/merge` | POST | 중복 병합 (target_id 필요) |
| `DELETE /api/ontology/objects/{id}` | DELETE | 아카이브 (soft delete) |
| `GET /api/ontology/links` | GET | 관계 목록 |
| `GET /api/ontology/graph` | GET | 시각화용 전체 그래프 |
| `POST /api/ontology/extract/preview` | POST | 텍스트 → 추출 미리보기 (저장하지 않음) |
| `POST /api/ontology/extract/confirm` | POST | 미리보기 결과 확인 후 파이프라인 실행 |
| `GET /api/ontology/stats` | GET | 노드/엣지 통계 |
| `GET /api/ontology/actions/log` | GET | Action 실행 이력 |

### 9.2 응답 스키마

```python
class GraphResponse(BaseModel):
    nodes: list[NodeResponse]
    edges: list[EdgeResponse]
    stats: GraphStats

class NodeResponse(BaseModel):
    id: str
    name: str
    type_name: str
    parent_category: str
    properties: dict
    status: str
    confidence: float
    neighbor_count: int

class EdgeResponse(BaseModel):
    id: str
    source_id: str
    target_id: str
    relation: str
    properties: dict
    confidence: float

class GraphStats(BaseModel):
    total_nodes: int
    total_edges: int
    nodes_by_category: dict[str, int]
    draft_count: int
    avg_confidence: float
```

---

## 10. 기존 도메인 수정 사항

### 10.1 이벤트 버스 연결

```python
# main.py — 어댑터 등록 (DomainEvent.handle() 메서드 사용)
from alma.core.events import event_bus

goal_adapter = GoalAdapter(pipeline, ontology_service)
habit_adapter = HabitAdapter(pipeline, ontology_service)
chat_adapter = ChatAdapter(extractor, pipeline)
memory_adapter = MemoryAdapter(pipeline, ontology_service)
knowledge_adapter = KnowledgeAdapter(extractor, pipeline)

# 각 어댑터의 handle() 메서드를 이벤트 타입별로 구독
event_bus.subscribe("goal.created", goal_adapter.handle)
event_bus.subscribe("goal.updated", goal_adapter.handle)
event_bus.subscribe("goal.deleted", goal_adapter.handle)
event_bus.subscribe("habit.created", habit_adapter.handle)
event_bus.subscribe("habit.deleted", habit_adapter.handle)
event_bus.subscribe("habit.checkin_completed", habit_adapter.handle)
event_bus.subscribe("message.received", chat_adapter.handle)
event_bus.subscribe("memory.created", memory_adapter.handle)
event_bus.subscribe("knowledge.document_ready", knowledge_adapter.handle)
```

### 10.2 ChatService 수정

```python
# domain/chat/service.py
# 기존 process_message에 온톨로지 컨텍스트 주입 추가
if self.ontology_service:
    # 현재 대화 관련 온톨로지 노드 검색
    ontology_context = await self.ontology_service.search_relevant(
        user_id, content, limit=5
    )
    if ontology_context:
        ontology_ctx = "\n".join(
            f"[Ontology] {n.name} ({n.type_name}): {json.dumps(n.properties, ensure_ascii=False)}"
            for n in ontology_context
        )
        personalized_prompt += f"\n\n{ontology_ctx}"
```

---

## 11. Frontend (기본 관리 페이지)

### 11.1 파일 구조

```
frontend/
├── app/ontology/page.tsx              # 온톨로지 메인 페이지
├── components/ontology/               # 온톨로지 전용 서브디렉토리
│   ├── OntologyStats.tsx              # 노드/엣지 통계 카드
│   ├── ObjectList.tsx                 # 노드 목록 (필터/검색)
│   ├── ObjectDetail.tsx               # 노드 상세 + 연결 관계
│   ├── DraftReview.tsx                # draft 노드 검토/승인 UI
│   └── ManualExtract.tsx              # 수동 텍스트 → 추출 입력
└── hooks/
    └── useOntology.ts                 # API 훅
```

### 11.2 페이지 구성

- **통계 대시보드**: 노드/엣지 수, 카테고리별 분포, draft 대기 수
- **노드 목록**: 타입/카테고리/상태 필터, 검색, 페이지네이션
- **노드 상세**: 속성, 연결된 관계, 원본 소스 링크
- **Draft 검토**: 대기 중인 노드 목록, 승인/거부/병합 액션
- **수동 추출**: 텍스트 입력 → 의미 추출 미리보기 → 확인 후 저장

> Note: 그래프 시각화 UI는 Phase B 범위. Phase A에서는 목록/상세 기반 관리만.

---

## 12. 파일 구조 (전체)

### Backend — Create

| 파일 | 책임 |
|------|------|
| `domain/ontology/__init__.py` | 패키지 |
| `domain/ontology/models.py` | RawExtraction, NodeCandidate, EdgeCandidate, PurificationResult, SchemaContext, GraphData, GraphNode 값 객체 |
| `domain/ontology/service.py` | OntologyService (CRUD + 그래프 쿼리 + 임베딩) |
| `domain/ontology/repository.py` | ObjectTypeRepo, ObjectRepo, LinkTypeRepo, LinkRepo, ActionTypeRepo, ActionLogRepo |
| `domain/ontology/extractor.py` | SemanticExtractor (LLM 의미 추출) |
| `domain/ontology/pipeline.py` | PurificationPipeline (정제 4단계) |
| `domain/ontology/dedup.py` | DeduplicationService (임베딩 유사도 검색) |
| `domain/ontology/validator.py` | SchemaValidator (타입/속성 검증 + 정규화) |
| `domain/ontology/seed.py` | SystemSeed (기본 타입 시딩) |
| `domain/ontology/adapters/__init__.py` | 패키지 |
| `domain/ontology/adapters/base.py` | DomainAdapter Protocol |
| `domain/ontology/adapters/goal_adapter.py` | GoalAdapter |
| `domain/ontology/adapters/habit_adapter.py` | HabitAdapter |
| `domain/ontology/adapters/chat_adapter.py` | ChatAdapter |
| `domain/ontology/adapters/memory_adapter.py` | MemoryAdapter |
| `domain/ontology/adapters/knowledge_adapter.py` | KnowledgeAdapter |
| `api/ontology.py` | REST API 라우터 |
| `tests/test_ontology.py` | 유닛 테스트 |
| `tests/test_ontology_pipeline.py` | 파이프라인 통합 테스트 |
| `tests/test_ontology_adapters.py` | 어댑터 테스트 |

### Backend — Modify

| 파일 | 변경 |
|------|------|
| `models/models.py` | +ObjectType, +OntologyObject, +LinkType, +OntologyLink, +OntologyActionType, +OntologyActionLog |
| `main.py` | +ontology_router 등록, +어댑터 이벤트 구독 |
| `domain/chat/service.py` | +ontology_service DI, 온톨로지 컨텍스트 주입, +message.received 이벤트 발행 |
| `domain/growth/service.py` | +goal.updated, goal.deleted 이벤트 발행 추가 (goal.created는 이미 존재) |
| `domain/memory/service.py` | +memory.created 이벤트 발행 추가 |
| `domain/knowledge/service.py` | +knowledge.document_ready 이벤트 발행 추가 |
| Alembic migration | +6개 테이블, +인덱스 |

### Frontend — Create

| 파일 | 책임 |
|------|------|
| `app/ontology/page.tsx` | 온톨로지 관리 메인 페이지 |
| `components/OntologyStats.tsx` | 통계 카드 |
| `components/ObjectList.tsx` | 노드 목록 |
| `components/ObjectDetail.tsx` | 노드 상세 |
| `components/DraftReview.tsx` | Draft 검토 UI |
| `components/ManualExtract.tsx` | 수동 추출 입력 |
| `hooks/useOntology.ts` | API 훅 |

### Frontend — Modify

| 파일 | 변경 |
|------|------|
| `lib/types.ts` | +온톨로지 관련 타입 |
| `components/common/NavBar.tsx` | +온톨로지 탭 |
| `middleware.ts` | +/ontology 보호 |

---

## 13. 테스트 전략

| # | 테스트 | 내용 |
|---|---|---|
| 1 | test_system_seed_creates_types | 시스템 기본 타입 13+10+7개 생성 확인 |
| 2 | test_create_object_type | 커스텀 Object Type 생성 |
| 3 | test_create_object_with_validation | 스키마 검증 통과하는 Object 생성 |
| 4 | test_create_object_invalid_schema | 잘못된 속성 → 거부 |
| 5 | test_semantic_extraction_basic | 단순 텍스트 → 노드/엣지 추출 |
| 6 | test_semantic_extraction_korean | 한국어 텍스트 → 한국어 노드 |
| 7 | test_dedup_auto_merge | 유사도 > 0.98 → 자동 병합 |
| 8 | test_dedup_review_threshold | 유사도 0.92~0.98 → draft |
| 9 | test_dedup_new_node | 유사도 < 0.92 → 새 노드 |
| 10 | test_confidence_gate_verified | confidence >= 0.8 → verified |
| 11 | test_confidence_gate_draft | 0.5 <= confidence < 0.8 → draft |
| 12 | test_confidence_gate_reject | confidence < 0.5 → reject |
| 13 | test_goal_adapter_creates_object | Goal 생성 이벤트 → Object 생성 |
| 14 | test_habit_adapter_with_goal_link | Habit + goal_id → Object + supports Link |
| 15 | test_chat_adapter_extracts | 채팅 메시지 → 의미 추출 → 파이프라인 |
| 16 | test_chat_adapter_skips_short | 30자 미만 + 확인형 패턴 메시지 → 스킵 |
| 17 | test_graph_neighbors_depth | N홉 이웃 조회 (depth=1,2,3) |
| 18 | test_full_graph_response | 시각화용 전체 그래프 응답 구조 |
| 19 | test_verify_draft_object | draft → verified 상태 전환 |
| 20 | test_merge_objects_api | API를 통한 수동 병합 |
| 21 | test_action_log_recorded | 모든 변경에 Action 로그 기록 |
| 22 | test_manual_extract_endpoint | POST /extract → 추출 결과 반환 (preview), 이후 별도 create 호출로 저장 |
| 23 | test_bidirectional_goal_sync | Goal 수정 → Object 속성 업데이트 |
| 24 | test_archive_cascades_links | Object 아카이브 시 관련 Link 처리 |

---

## 14. 마이그레이션 전략

### 14.1 신규 테이블 생성

```bash
alembic revision --autogenerate -m "add ontology core tables"
```

6개 테이블: `object_types`, `ontology_objects`, `link_types`, `ontology_links`, `ontology_action_types`, `ontology_action_logs`

### 14.2 기존 데이터 마이그레이션

마이그레이션 스크립트에서 기존 데이터를 온톨로지로 변환:

```python
# 1. 시스템 기본 타입 시딩
# 2. 기존 Goals → Object (type=Goal, source_type=goal, confidence=1.0, status=verified)
# 3. 기존 Habits → Object (type=Habit, source_type=habit, confidence=1.0, status=verified)
# 4. Habit.goal_id가 있으면 → supports Link 생성
# 5. 기존 UserMemories → Object (type=카테고리별, source_type=memory)
# 6. GoalConversationLink → related_to Link
```

### 14.3 점진적 어댑터 활성화

1. 마이그레이션 + 시딩 실행
2. GoalAdapter, HabitAdapter 활성화 (시스템 이벤트, 확실한 매핑)
3. MemoryAdapter 활성화
4. ChatAdapter 활성화 (LLM 추출, 가장 복잡)
5. KnowledgeAdapter 활성화

---

## 15. Phase A 이후 확장 경로

```
Phase A (현재): 온톨로지 코어 + 정제 파이프라인 + 어댑터
    ↓
Phase B: 그래프 시각화 UI (Obsidian 스타일 노드-엣지 탐색)
    - D3.js / Cytoscape.js / React Flow 기반
    - /api/ontology/graph 엔드포인트 활용
    ↓
Phase C: 추론 엔진 (패턴 발견 + 미래 예측)
    - 그래프 분석 알고리즘 (PageRank, Community Detection)
    - LLM 기반 패턴 해석
    ↓
Phase D: 에이전트 워크플로우 + MCP 자율화
    - Action Type 기반 에이전트 의사결정
    - MCP 서버 연결로 실제 외부 시스템 조작
```
