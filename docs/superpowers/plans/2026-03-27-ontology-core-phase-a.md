# Phase A: Ontology Core Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** VIVARA에 팔란티어 스타일 온톨로지 코어를 추가하여 모든 데이터에 의미를 부여하고 관계를 연결하는 인지 엔진 기반을 구축한다.

**Architecture:** 기존 PostgreSQL에 6개 온톨로지 테이블(ontology_object_types, ontology_objects, ontology_link_types, ontology_links, ontology_action_types, ontology_action_logs)을 추가. LLM 기반 SemanticExtractor가 텍스트에서 노드/엣지를 추출하고, 4단계 PurificationPipeline(중복제거→스키마검증→정규화→신뢰도게이트)을 거쳐 검증된 데이터만 저장. 5개 DomainAdapter(Goal, Habit, Chat, Memory, Knowledge)가 기존 바운디드 컨텍스트와 양방향 싱크.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 async, pgvector, Alembic, pytest-asyncio, Pydantic v2

**Spec:** `docs/superpowers/specs/2026-03-27-ontology-core-design.md`

---

## File Structure

### Backend — Create

| File | Responsibility |
|------|---------------|
| `domain/ontology/__init__.py` | Package init |
| `domain/ontology/models.py` | Value objects: NodeCandidate, EdgeCandidate, RawExtraction, PurificationResult, SchemaContext, GraphData, GraphNode |
| `domain/ontology/repository.py` | ObjectTypeRepo, ObjectRepo, LinkTypeRepo, LinkRepo, ActionTypeRepo, ActionLogRepo |
| `domain/ontology/service.py` | OntologyService: CRUD + graph query + embedding |
| `domain/ontology/extractor.py` | SemanticExtractor: LLM-based meaning extraction |
| `domain/ontology/pipeline.py` | PurificationPipeline: 4-stage validation gate |
| `domain/ontology/dedup.py` | DeduplicationService: embedding similarity search |
| `domain/ontology/validator.py` | SchemaValidator: type/property validation + normalization |
| `domain/ontology/seed.py` | SystemSeed: default types seeding (13 ObjectTypes + 10 LinkTypes + 7 ActionTypes) |
| `domain/ontology/adapters/__init__.py` | Adapters package |
| `domain/ontology/adapters/base.py` | DomainAdapter base class |
| `domain/ontology/adapters/goal_adapter.py` | GoalAdapter |
| `domain/ontology/adapters/habit_adapter.py` | HabitAdapter |
| `domain/ontology/adapters/chat_adapter.py` | ChatAdapter |
| `domain/ontology/adapters/memory_adapter.py` | MemoryAdapter |
| `domain/ontology/adapters/knowledge_adapter.py` | KnowledgeAdapter |
| `api/ontology.py` | REST API router (15 endpoints) |
| `tests/test_ontology_models.py` | Value object + ORM tests |
| `tests/test_ontology_service.py` | Service unit tests |
| `tests/test_ontology_pipeline.py` | Pipeline integration tests |
| `tests/test_ontology_adapters.py` | Adapter tests |
| `tests/test_ontology_api.py` | API endpoint tests |

### Backend — Modify

| File | Change |
|------|--------|
| `models/models.py` | +6 ORM classes (ObjectType, OntologyObject, LinkType, OntologyLink, OntologyActionType, OntologyActionLog) |
| `config.py` | +ontology settings (thresholds, min_length) |
| `main.py` | +ontology_router, +adapter event subscriptions |
| `domain/growth/service.py` | +goal.updated, goal.deleted event emissions |
| `domain/memory/service.py` | +memory.created event emission |
| `domain/knowledge/service.py` | +knowledge.document_ready event emission |
| `domain/chat/service.py` | +ontology context injection in process_message |
| Alembic migration | +6 tables, +indexes, +constraints |

### Frontend — Create

| File | Responsibility |
|------|---------------|
| `app/ontology/page.tsx` | Ontology management page |
| `components/ontology/OntologyStats.tsx` | Stats cards |
| `components/ontology/ObjectList.tsx` | Node list with filters |
| `components/ontology/ObjectDetail.tsx` | Node detail + relations |
| `components/ontology/DraftReview.tsx` | Draft review UI |
| `components/ontology/ManualExtract.tsx` | Manual text extraction |
| `hooks/useOntology.ts` | API hooks |

### Frontend — Modify

| File | Change |
|------|--------|
| `lib/types.ts` | +ontology types |
| `components/common/NavBar.tsx` | +ontology tab |
| `middleware.ts` | +/ontology protection |

---

## Chunk 1: ORM Models + Migration + Config

### Task 1: Add ontology settings to config

**Files:**
- Modify: `backend/src/alma/config.py`

- [ ] **Step 1: Read current config.py**

Check current Settings class to understand the pattern.

- [ ] **Step 2: Add ontology settings**

Add to `Settings` class in `backend/src/alma/config.py`:

```python
    # Ontology settings
    ontology_dedup_auto_merge_threshold: float = 0.98
    ontology_dedup_review_threshold: float = 0.92
    ontology_confidence_auto_verify: float = 0.8
    ontology_confidence_reject: float = 0.5
    ontology_chat_min_length: int = 30
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/alma/config.py
git commit -m "feat(ontology): add ontology settings to config"
```

### Task 2: Add 6 ORM models to models.py

**Files:**
- Modify: `backend/src/alma/models/models.py`
- Test: `backend/tests/test_ontology_models.py`

- [ ] **Step 1: Write failing test for ORM imports**

Create `backend/tests/test_ontology_models.py`:

```python
import pytest


def test_ontology_models_importable():
    from alma.models.models import (
        LinkType,
        OntologyActionLog,
        OntologyActionType,
        OntologyLink,
        OntologyObject,
        ObjectType,
    )

    assert ObjectType.__tablename__ == "ontology_object_types"
    assert OntologyObject.__tablename__ == "ontology_objects"
    assert LinkType.__tablename__ == "ontology_link_types"
    assert OntologyLink.__tablename__ == "ontology_links"
    assert OntologyActionType.__tablename__ == "ontology_action_types"
    assert OntologyActionLog.__tablename__ == "ontology_action_logs"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_ontology_models.py::test_ontology_models_importable -v`
Expected: FAIL with ImportError

- [ ] **Step 3: Add ObjectType model**

Add to `backend/src/alma/models/models.py` after `PushSubscription` class:

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
    property_schema: Mapped[dict] = mapped_column("schema", JSONB, default=dict, server_default="{}")
    embedding = mapped_column(Vector(768), nullable=True)
    is_system: Mapped[bool] = mapped_column(default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_object_types_user_name"),
        Index("idx_object_types_user", "user_id", "parent_category"),
        Index(
            "idx_object_types_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        CheckConstraint(
            "parent_category IN ('Entity','Action','Concept','Attribute','Temporal')",
            name="ck_object_types_category",
        ),
    )
```

- [ ] **Step 4: Add OntologyObject model**

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
            "idx_objects_embedding",
            "embedding",
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
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="ck_objects_confidence"),
    )
```

- [ ] **Step 5: Add LinkType model**

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

- [ ] **Step 6: Add OntologyLink model**

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
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="ck_links_confidence"),
        CheckConstraint(
            "source_origin IN ('llm','system','manual')",
            name="ck_links_source_origin",
        ),
        CheckConstraint("source_id != target_id", name="ck_links_no_self_ref"),
    )
```

- [ ] **Step 7: Add OntologyActionType and OntologyActionLog models**

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

- [ ] **Step 8: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_ontology_models.py::test_ontology_models_importable -v`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add backend/src/alma/models/models.py backend/tests/test_ontology_models.py
git commit -m "feat(ontology): add 6 ontology ORM models"
```

### Task 3: Create Alembic migration

**Files:**
- Create: Alembic migration file (auto-generated)

- [ ] **Step 1: Generate migration**

```bash
cd backend
DATABASE_URL="$DATABASE_URL" alembic revision --autogenerate -m "add ontology core tables"
```

- [ ] **Step 2: Review generated migration**

Open the generated file. Verify it includes:
- 6 new tables: `ontology_object_types`, `ontology_objects`, `ontology_link_types`, `ontology_links`, `ontology_action_types`, `ontology_action_logs`
- All indexes and constraints
- Add `import pgvector.sqlalchemy.vector` if missing

- [ ] **Step 3: Run migration**

```bash
DATABASE_URL="$DATABASE_URL" alembic upgrade head
```

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/
git commit -m "feat(ontology): add migration for ontology core tables"
```

---

## Chunk 2: Domain Value Objects + Repository + Seed

### Task 4: Create ontology value objects

**Files:**
- Create: `backend/src/alma/domain/ontology/__init__.py`
- Create: `backend/src/alma/domain/ontology/models.py`

- [ ] **Step 1: Create package**

Create `backend/src/alma/domain/ontology/__init__.py` (empty file).

- [ ] **Step 2: Write failing test for value objects**

Add to `backend/tests/test_ontology_models.py`:

```python
def test_node_candidate_defaults():
    from alma.domain.ontology.models import NodeCandidate

    nc = NodeCandidate(
        name="Learn Python",
        parent_category="Action",
        sub_type="Goal",
        properties={"category": "learning"},
        confidence=0.9,
    )
    assert nc.action == "create"
    assert nc.status == "draft"
    assert nc.source_type == "llm_extracted"
    assert nc.merge_target_id is None


def test_raw_extraction():
    from alma.domain.ontology.models import EdgeCandidate, NodeCandidate, RawExtraction

    extraction = RawExtraction(
        node_candidates=[
            NodeCandidate(
                name="Test", parent_category="Concept", sub_type="Topic",
                properties={}, confidence=0.8,
            )
        ],
        edge_candidates=[
            EdgeCandidate(
                source_name="A", target_name="B", relation="supports",
                properties={}, confidence=0.9,
            )
        ],
    )
    assert len(extraction.node_candidates) == 1
    assert len(extraction.edge_candidates) == 1


def test_purification_result():
    from alma.domain.ontology.models import PurificationResult

    result = PurificationResult()
    assert result.created_objects == []
    assert result.rejected_count == 0
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_ontology_models.py::test_node_candidate_defaults -v`
Expected: FAIL

- [ ] **Step 4: Implement value objects**

Create `backend/src/alma/domain/ontology/models.py`:

```python
import uuid
from dataclasses import dataclass, field


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
    action: str = "create"
    merge_target_id: uuid.UUID | None = None
    status: str = "draft"


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
    node_candidates: list[NodeCandidate] = field(default_factory=list)
    edge_candidates: list[EdgeCandidate] = field(default_factory=list)

    @staticmethod
    def from_llm_response(content: str) -> "RawExtraction":
        """Parse LLM JSON response into RawExtraction."""
        import json

        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            return RawExtraction()

        nodes = [
            NodeCandidate(
                name=n["name"],
                parent_category=n["parent_category"],
                sub_type=n["sub_type"],
                properties=n.get("properties", {}),
                confidence=n.get("confidence", 0.5),
            )
            for n in data.get("nodes", [])
        ]
        edges = [
            EdgeCandidate(
                source_name=e["source_name"],
                target_name=e["target_name"],
                relation=e["relation"],
                properties=e.get("properties", {}),
                confidence=e.get("confidence", 0.5),
            )
            for e in data.get("edges", [])
        ]
        return RawExtraction(node_candidates=nodes, edge_candidates=edges)


@dataclass
class PurificationResult:
    created_objects: list[uuid.UUID] = field(default_factory=list)
    merged_objects: list[tuple] = field(default_factory=list)
    review_objects: list[uuid.UUID] = field(default_factory=list)
    rejected_count: int = 0
    created_links: list[uuid.UUID] = field(default_factory=list)


@dataclass
class SchemaContext:
    object_type_names: list[str] = field(default_factory=list)
    link_type_names: list[str] = field(default_factory=list)
    recent_node_names: list[str] = field(default_factory=list)


@dataclass
class GraphNode:
    id: uuid.UUID
    name: str
    type_id: uuid.UUID
    depth: int


@dataclass
class GraphData:
    nodes: list[dict] = field(default_factory=list)
    edges: list[dict] = field(default_factory=list)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_ontology_models.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/alma/domain/ontology/
git commit -m "feat(ontology): add domain value objects"
```

### Task 5: Create ontology repositories

**Files:**
- Create: `backend/src/alma/domain/ontology/repository.py`
- Test: `backend/tests/test_ontology_service.py`

- [ ] **Step 1: Write failing test for ObjectTypeRepo**

Create `backend/tests/test_ontology_service.py`:

```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.ontology.repository import ObjectTypeRepository


@pytest.mark.asyncio
async def test_create_object_type(db_session: AsyncSession, test_user):
    repo = ObjectTypeRepository(db_session)
    ot = await repo.create(
        user_id=test_user.id,
        name="Goal",
        parent_category="Action",
        property_schema={"category": "str"},
        is_system=True,
    )
    assert ot.name == "Goal"
    assert ot.parent_category == "Action"
    assert ot.is_system is True


@pytest.mark.asyncio
async def test_get_object_type_by_name(db_session: AsyncSession, test_user):
    repo = ObjectTypeRepository(db_session)
    await repo.create(
        user_id=test_user.id, name="Habit", parent_category="Action",
    )
    found = await repo.get_by_name(test_user.id, "Habit")
    assert found is not None
    assert found.name == "Habit"

    not_found = await repo.get_by_name(test_user.id, "NonExistent")
    assert not_found is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_ontology_service.py::test_create_object_type -v`
Expected: FAIL

- [ ] **Step 3: Implement repository**

Create `backend/src/alma/domain/ontology/repository.py`:

```python
import uuid

from sqlalchemy import desc, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from alma.models.models import (
    LinkType,
    OntologyActionLog,
    OntologyActionType,
    OntologyLink,
    OntologyObject,
    ObjectType,
)


class ObjectTypeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        name: str,
        parent_category: str,
        description: str | None = None,
        property_schema: dict | None = None,
        embedding: list[float] | None = None,
        is_system: bool = False,
    ) -> ObjectType:
        ot = ObjectType(
            user_id=user_id,
            name=name,
            parent_category=parent_category,
            description=description,
            property_schema=property_schema or {},
            embedding=embedding,
            is_system=is_system,
        )
        self.session.add(ot)
        await self.session.flush()
        return ot

    async def get_by_name(self, user_id: uuid.UUID, name: str) -> ObjectType | None:
        result = await self.session.execute(
            select(ObjectType).where(
                ObjectType.user_id == user_id, ObjectType.name == name
            )
        )
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: uuid.UUID) -> list[ObjectType]:
        result = await self.session.execute(
            select(ObjectType)
            .where(ObjectType.user_id == user_id)
            .order_by(ObjectType.parent_category, ObjectType.name)
        )
        return list(result.scalars().all())


class ObjectRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, obj: OntologyObject) -> OntologyObject:
        self.session.add(obj)
        await self.session.flush()
        return obj

    async def get(self, object_id: uuid.UUID) -> OntologyObject | None:
        result = await self.session.execute(
            select(OntologyObject).where(OntologyObject.id == object_id)
        )
        return result.scalar_one_or_none()

    async def find_by_source(
        self, source_type: str, source_id: uuid.UUID
    ) -> OntologyObject | None:
        result = await self.session.execute(
            select(OntologyObject).where(
                OntologyObject.source_type == source_type,
                OntologyObject.source_id == source_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_user(
        self,
        user_id: uuid.UUID,
        status: str | None = None,
        type_id: uuid.UUID | None = None,
    ) -> list[OntologyObject]:
        query = select(OntologyObject).where(OntologyObject.user_id == user_id)
        if status:
            query = query.where(OntologyObject.status == status)
        if type_id:
            query = query.where(OntologyObject.type_id == type_id)
        query = query.order_by(desc(OntologyObject.updated_at))
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def list_recent(self, user_id: uuid.UUID, limit: int = 20) -> list[OntologyObject]:
        result = await self.session.execute(
            select(OntologyObject)
            .where(OntologyObject.user_id == user_id, OntologyObject.status == "verified")
            .order_by(desc(OntologyObject.updated_at))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def find_by_name(self, user_id: uuid.UUID, name: str) -> OntologyObject | None:
        result = await self.session.execute(
            select(OntologyObject).where(
                OntologyObject.user_id == user_id,
                OntologyObject.name == name,
                OntologyObject.status != "archived",
            )
        )
        return result.scalar_one_or_none()

    async def count_by_category(self, user_id: uuid.UUID) -> dict[str, int]:
        result = await self.session.execute(
            select(
                ObjectType.parent_category,
                func.count(OntologyObject.id),
            )
            .join(ObjectType, OntologyObject.type_id == ObjectType.id)
            .where(OntologyObject.user_id == user_id)
            .group_by(ObjectType.parent_category)
        )
        return dict(result.all())


class LinkTypeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        name: str,
        cardinality: str = "N:M",
        description: str | None = None,
        source_type_id: uuid.UUID | None = None,
        target_type_id: uuid.UUID | None = None,
        is_system: bool = False,
    ) -> LinkType:
        lt = LinkType(
            user_id=user_id,
            name=name,
            cardinality=cardinality,
            description=description,
            source_type_id=source_type_id,
            target_type_id=target_type_id,
            is_system=is_system,
        )
        self.session.add(lt)
        await self.session.flush()
        return lt

    async def get_by_name(self, user_id: uuid.UUID, name: str) -> LinkType | None:
        result = await self.session.execute(
            select(LinkType).where(LinkType.user_id == user_id, LinkType.name == name)
        )
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: uuid.UUID) -> list[LinkType]:
        result = await self.session.execute(
            select(LinkType).where(LinkType.user_id == user_id).order_by(LinkType.name)
        )
        return list(result.scalars().all())


class LinkRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, link: OntologyLink) -> OntologyLink:
        self.session.add(link)
        await self.session.flush()
        return link

    async def list_by_user(self, user_id: uuid.UUID) -> list[OntologyLink]:
        result = await self.session.execute(
            select(OntologyLink)
            .where(OntologyLink.user_id == user_id)
            .order_by(desc(OntologyLink.created_at))
        )
        return list(result.scalars().all())

    async def list_by_object(self, object_id: uuid.UUID) -> list[OntologyLink]:
        result = await self.session.execute(
            select(OntologyLink).where(
                (OntologyLink.source_id == object_id) | (OntologyLink.target_id == object_id)
            )
        )
        return list(result.scalars().all())


class ActionTypeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self, user_id: uuid.UUID, name: str, is_system: bool = False, **kwargs
    ) -> OntologyActionType:
        at = OntologyActionType(user_id=user_id, name=name, is_system=is_system, **kwargs)
        self.session.add(at)
        await self.session.flush()
        return at

    async def get_by_name(self, user_id: uuid.UUID, name: str) -> OntologyActionType | None:
        result = await self.session.execute(
            select(OntologyActionType).where(
                OntologyActionType.user_id == user_id, OntologyActionType.name == name
            )
        )
        return result.scalar_one_or_none()


class ActionLogRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, log: OntologyActionLog) -> OntologyActionLog:
        self.session.add(log)
        await self.session.flush()
        return log

    async def list_by_user(
        self, user_id: uuid.UUID, limit: int = 50
    ) -> list[OntologyActionLog]:
        result = await self.session.execute(
            select(OntologyActionLog)
            .where(OntologyActionLog.user_id == user_id)
            .order_by(desc(OntologyActionLog.created_at))
            .limit(limit)
        )
        return list(result.scalars().all())
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_ontology_service.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/alma/domain/ontology/repository.py backend/tests/test_ontology_service.py
git commit -m "feat(ontology): add ontology repositories"
```

### Task 6: Create system seed

**Files:**
- Create: `backend/src/alma/domain/ontology/seed.py`
- Test: add to `backend/tests/test_ontology_service.py`

- [ ] **Step 1: Write failing test**

Add to `backend/tests/test_ontology_service.py`:

```python
from alma.domain.ontology.seed import SystemSeed


@pytest.mark.asyncio
async def test_system_seed_creates_types(db_session: AsyncSession, test_user):
    seed = SystemSeed(db_session)
    await seed.seed_for_user(test_user.id)

    ot_repo = ObjectTypeRepository(db_session)
    object_types = await ot_repo.list_by_user(test_user.id)
    assert len(object_types) == 13  # 13 system object types

    from alma.domain.ontology.repository import LinkTypeRepository
    lt_repo = LinkTypeRepository(db_session)
    link_types = await lt_repo.list_by_user(test_user.id)
    assert len(link_types) == 10  # 10 system link types

    from alma.domain.ontology.repository import ActionTypeRepository
    at_repo = ActionTypeRepository(db_session)
    # Check one action type exists
    create_action = await at_repo.get_by_name(test_user.id, "create_object")
    assert create_action is not None
    assert create_action.is_system is True


@pytest.mark.asyncio
async def test_system_seed_idempotent(db_session: AsyncSession, test_user):
    seed = SystemSeed(db_session)
    await seed.seed_for_user(test_user.id)
    await seed.seed_for_user(test_user.id)  # second call should not error

    ot_repo = ObjectTypeRepository(db_session)
    object_types = await ot_repo.list_by_user(test_user.id)
    assert len(object_types) == 13  # still 13, no duplicates
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_ontology_service.py::test_system_seed_creates_types -v`
Expected: FAIL

- [ ] **Step 3: Implement seed**

Create `backend/src/alma/domain/ontology/seed.py`:

```python
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.ontology.repository import (
    ActionTypeRepository,
    LinkTypeRepository,
    ObjectTypeRepository,
)

SYSTEM_OBJECT_TYPES = [
    {"name": "Person", "parent": "Entity", "schema": {"role": "str"}},
    {"name": "Project", "parent": "Entity", "schema": {"status": "str", "deadline": "date"}},
    {"name": "Organization", "parent": "Entity", "schema": {"domain": "str"}},
    {"name": "Goal", "parent": "Action", "schema": {"category": "str", "progress": "int", "target_date": "date"}},
    {"name": "Habit", "parent": "Action", "schema": {"frequency": "str", "streak": "int"}},
    {"name": "Task", "parent": "Action", "schema": {"priority": "str", "due_date": "date", "status": "str"}},
    {"name": "Topic", "parent": "Concept", "schema": {"domain": "str"}},
    {"name": "Skill", "parent": "Concept", "schema": {"level": "str"}},
    {"name": "Value", "parent": "Concept", "schema": {"importance": "float"}},
    {"name": "Metric", "parent": "Attribute", "schema": {"unit": "str", "value": "float"}},
    {"name": "Emotion", "parent": "Attribute", "schema": {"intensity": "float"}},
    {"name": "Event", "parent": "Temporal", "schema": {"start": "datetime", "end": "datetime"}},
    {"name": "Period", "parent": "Temporal", "schema": {"start": "date", "end": "date"}},
]

SYSTEM_LINK_TYPES = [
    {"name": "supports", "cardinality": "N:M", "desc": "A supports/promotes B"},
    {"name": "blocks", "cardinality": "N:M", "desc": "A blocks/hinders B"},
    {"name": "causes", "cardinality": "N:M", "desc": "A causes B"},
    {"name": "part_of", "cardinality": "N:1", "desc": "A is part of B"},
    {"name": "related_to", "cardinality": "N:M", "desc": "A is related to B"},
    {"name": "depends_on", "cardinality": "N:M", "desc": "A depends on B"},
    {"name": "measured_by", "cardinality": "N:M", "desc": "A is measured by B"},
    {"name": "belongs_to", "cardinality": "N:1", "desc": "A belongs to B"},
    {"name": "precedes", "cardinality": "N:M", "desc": "A precedes B"},
    {"name": "contradicts", "cardinality": "N:M", "desc": "A contradicts B"},
]

SYSTEM_ACTION_TYPES = [
    {"name": "create_object", "desc": "Create node"},
    {"name": "update_object", "desc": "Update node properties"},
    {"name": "archive_object", "desc": "Archive node"},
    {"name": "merge_objects", "desc": "Merge duplicate nodes"},
    {"name": "create_link", "desc": "Create relationship"},
    {"name": "remove_link", "desc": "Remove relationship"},
    {"name": "verify_object", "desc": "Verify draft node"},
]


class SystemSeed:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.ot_repo = ObjectTypeRepository(session)
        self.lt_repo = LinkTypeRepository(session)
        self.at_repo = ActionTypeRepository(session)

    async def seed_for_user(self, user_id: uuid.UUID) -> None:
        for ot in SYSTEM_OBJECT_TYPES:
            existing = await self.ot_repo.get_by_name(user_id, ot["name"])
            if not existing:
                await self.ot_repo.create(
                    user_id=user_id,
                    name=ot["name"],
                    parent_category=ot["parent"],
                    property_schema=ot.get("schema", {}),
                    is_system=True,
                )

        for lt in SYSTEM_LINK_TYPES:
            existing = await self.lt_repo.get_by_name(user_id, lt["name"])
            if not existing:
                await self.lt_repo.create(
                    user_id=user_id,
                    name=lt["name"],
                    cardinality=lt["cardinality"],
                    description=lt["desc"],
                    is_system=True,
                )

        for at in SYSTEM_ACTION_TYPES:
            existing = await self.at_repo.get_by_name(user_id, at["name"])
            if not existing:
                await self.at_repo.create(
                    user_id=user_id,
                    name=at["name"],
                    is_system=True,
                )

        await self.session.flush()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_ontology_service.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/alma/domain/ontology/seed.py backend/tests/test_ontology_service.py
git commit -m "feat(ontology): add system schema seed (13 types + 10 links + 7 actions)"
```

---

## Chunk 3: OntologyService + Validator + Dedup

### Task 7: Create SchemaValidator

**Files:**
- Create: `backend/src/alma/domain/ontology/validator.py`

- [ ] **Step 1: Write failing test**

Add to `backend/tests/test_ontology_service.py`:

```python
from alma.domain.ontology.validator import SchemaValidator
from alma.domain.ontology.models import NodeCandidate


def test_validate_category_valid():
    v = SchemaValidator()
    assert v.validate_category("Entity") is True
    assert v.validate_category("Action") is True


def test_validate_category_invalid():
    v = SchemaValidator()
    assert v.validate_category("Invalid") is False


def test_normalize_removes_none():
    v = SchemaValidator()
    result = v.normalize({"a": 1, "b": None, "c": "hello"})
    assert result == {"a": 1, "c": "hello"}


def test_infer_schema():
    v = SchemaValidator()
    result = v.infer_schema({"name": "test", "count": 5, "active": True})
    assert result == {"name": "str", "count": "int", "active": "bool"}
```

- [ ] **Step 2: Implement SchemaValidator**

Create `backend/src/alma/domain/ontology/validator.py`:

```python
from alma.domain.ontology.models import NodeCandidate

VALID_CATEGORIES = {"Entity", "Action", "Concept", "Attribute", "Temporal"}


class SchemaValidator:
    def validate_category(self, parent_category: str) -> bool:
        return parent_category in VALID_CATEGORIES

    def validate_properties(self, candidate: NodeCandidate) -> bool:
        if not self.validate_category(candidate.parent_category):
            return False
        return True

    def normalize(self, properties: dict) -> dict:
        normalized = {}
        for k, v in properties.items():
            if v is None:
                continue
            if isinstance(v, str):
                v = v.strip()
            normalized[k] = v
        return normalized

    def infer_schema(self, properties: dict) -> dict:
        return {k: type(v).__name__ for k, v in properties.items() if v is not None}
```

- [ ] **Step 3: Run tests**

Run: `cd backend && python -m pytest tests/test_ontology_service.py -v`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/alma/domain/ontology/validator.py backend/tests/test_ontology_service.py
git commit -m "feat(ontology): add SchemaValidator"
```

### Task 8: Create DeduplicationService

**Files:**
- Create: `backend/src/alma/domain/ontology/dedup.py`
- Test: `backend/tests/test_ontology_pipeline.py`

- [ ] **Step 1: Write failing test**

Create `backend/tests/test_ontology_pipeline.py`:

```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.ontology.dedup import DeduplicationService, SimilarMatch
from alma.domain.ontology.repository import ObjectRepository, ObjectTypeRepository
from alma.domain.ontology.seed import SystemSeed
from alma.models.models import OntologyObject


@pytest.mark.asyncio
async def test_dedup_no_match(db_session: AsyncSession, test_user):
    """No existing objects = no match."""
    dedup = DeduplicationService(db_session)
    result = await dedup.find_similar(test_user.id, [0.1] * 768, threshold=0.92)
    assert result is None
```

- [ ] **Step 2: Implement DeduplicationService**

Create `backend/src/alma/domain/ontology/dedup.py`:

```python
import uuid
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class SimilarMatch:
    object_id: uuid.UUID
    name: str
    similarity: float


class DeduplicationService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def find_similar(
        self, user_id: uuid.UUID, embedding: list[float], threshold: float = 0.92
    ) -> SimilarMatch | None:
        query = text("""
            SELECT id, name, 1 - (embedding <=> :embedding::vector) AS similarity
            FROM ontology_objects
            WHERE user_id = :user_id
              AND status != 'archived'
              AND embedding IS NOT NULL
            ORDER BY embedding <=> :embedding::vector
            LIMIT 1
        """)
        result = await self.session.execute(
            query, {"user_id": user_id, "embedding": str(embedding)}
        )
        row = result.first()
        if row and row.similarity >= threshold:
            return SimilarMatch(
                object_id=row.id,
                name=row.name,
                similarity=row.similarity,
            )
        return None
```

- [ ] **Step 3: Run test**

Run: `cd backend && python -m pytest tests/test_ontology_pipeline.py::test_dedup_no_match -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/alma/domain/ontology/dedup.py backend/tests/test_ontology_pipeline.py
git commit -m "feat(ontology): add DeduplicationService"
```

### Task 9: Create OntologyService

**Files:**
- Create: `backend/src/alma/domain/ontology/service.py`

- [ ] **Step 1: Write failing test**

Add to `backend/tests/test_ontology_service.py`:

```python
from alma.domain.ontology.service import OntologyService
from alma.domain.ontology.models import NodeCandidate


@pytest.mark.asyncio
async def test_ontology_service_create_object(db_session: AsyncSession, test_user):
    seed = SystemSeed(db_session)
    await seed.seed_for_user(test_user.id)

    service = OntologyService(db_session, embedding_provider=None)
    candidate = NodeCandidate(
        name="Learn Python",
        parent_category="Action",
        sub_type="Goal",
        properties={"category": "learning"},
        confidence=1.0,
        source_type="goal",
    )
    obj_id = await service.create_object(test_user.id, candidate)
    assert obj_id is not None

    obj = await service.get_object(obj_id)
    assert obj.name == "Learn Python"
    assert obj.status == "draft"


@pytest.mark.asyncio
async def test_ontology_service_get_schema_context(db_session: AsyncSession, test_user):
    seed = SystemSeed(db_session)
    await seed.seed_for_user(test_user.id)

    service = OntologyService(db_session, embedding_provider=None)
    ctx = await service.get_user_schema_context(test_user.id)
    assert "Goal" in ctx.object_type_names
    assert "supports" in ctx.link_type_names


@pytest.mark.asyncio
async def test_ontology_service_verify_object(db_session: AsyncSession, test_user):
    seed = SystemSeed(db_session)
    await seed.seed_for_user(test_user.id)

    service = OntologyService(db_session, embedding_provider=None)
    candidate = NodeCandidate(
        name="Test Node", parent_category="Concept", sub_type="Topic",
        properties={}, confidence=0.7, source_type="manual",
    )
    obj_id = await service.create_object(test_user.id, candidate)

    await service.verify_object(obj_id)
    obj = await service.get_object(obj_id)
    assert obj.status == "verified"
```

- [ ] **Step 2: Implement OntologyService**

Create `backend/src/alma/domain/ontology/service.py`:

```python
import json
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.ontology.models import (
    GraphData,
    GraphNode,
    NodeCandidate,
    PurificationResult,
    SchemaContext,
)
from alma.domain.ontology.repository import (
    ActionLogRepository,
    ActionTypeRepository,
    LinkRepository,
    LinkTypeRepository,
    ObjectRepository,
    ObjectTypeRepository,
)
from alma.models.models import OntologyActionLog, OntologyLink, OntologyObject


class OntologyService:
    def __init__(self, session: AsyncSession, embedding_provider=None):
        self.session = session
        self.embedding = embedding_provider
        self.ot_repo = ObjectTypeRepository(session)
        self.obj_repo = ObjectRepository(session)
        self.lt_repo = LinkTypeRepository(session)
        self.link_repo = LinkRepository(session)
        self.at_repo = ActionTypeRepository(session)
        self.al_repo = ActionLogRepository(session)

    async def get_user_schema_context(self, user_id: uuid.UUID) -> SchemaContext:
        types = await self.ot_repo.list_by_user(user_id)
        link_types = await self.lt_repo.list_by_user(user_id)
        recent = await self.obj_repo.list_recent(user_id, limit=20)
        return SchemaContext(
            object_type_names=[t.name for t in types],
            link_type_names=[lt.name for lt in link_types],
            recent_node_names=[o.name for o in recent],
        )

    async def create_object(self, user_id: uuid.UUID, candidate: NodeCandidate) -> uuid.UUID:
        type_obj = await self.ot_repo.get_by_name(user_id, candidate.sub_type)
        if not type_obj:
            type_obj = await self.ot_repo.create(
                user_id=user_id,
                name=candidate.sub_type,
                parent_category=candidate.parent_category,
            )
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
        await self.obj_repo.create(obj)
        await self._log_action("create_object", user_id, "system", {"name": candidate.name}, str(obj.id))
        return obj.id

    async def get_object(self, object_id: uuid.UUID) -> OntologyObject | None:
        return await self.obj_repo.get(object_id)

    async def merge_object(self, target_id: uuid.UUID, candidate: NodeCandidate) -> None:
        target = await self.obj_repo.get(target_id)
        if not target:
            return
        merged_props = {**candidate.properties, **target.properties}
        target.properties = merged_props
        if candidate.confidence > target.confidence:
            target.confidence = candidate.confidence
        await self._log_action(
            "merge_objects", target.user_id, "system",
            {"merged_from": candidate.name}, str(target_id),
        )

    async def verify_object(self, object_id: uuid.UUID) -> None:
        obj = await self.obj_repo.get(object_id)
        if obj:
            obj.status = "verified"
            await self._log_action("verify_object", obj.user_id, "user", {}, str(object_id))

    async def archive_object(self, object_id: uuid.UUID) -> None:
        obj = await self.obj_repo.get(object_id)
        if obj:
            obj.status = "archived"
            await self._log_action("archive_object", obj.user_id, "system", {}, str(object_id))

    async def update_object_properties(self, object_id: uuid.UUID, changes: dict) -> None:
        obj = await self.obj_repo.get(object_id)
        if obj:
            obj.properties = {**obj.properties, **changes}
            await self._log_action(
                "update_object", obj.user_id, "adapter",
                {"changes": list(changes.keys())}, str(object_id),
            )

    async def find_by_source(self, source_type: str, source_id: uuid.UUID) -> OntologyObject | None:
        return await self.obj_repo.find_by_source(source_type, source_id)

    async def find_object_by_name(self, user_id: uuid.UUID, name: str) -> OntologyObject | None:
        return await self.obj_repo.find_by_name(user_id, name)

    async def create_link(
        self,
        user_id: uuid.UUID,
        relation: str,
        source_id: uuid.UUID,
        target_id: uuid.UUID,
        properties: dict | None = None,
        confidence: float = 1.0,
        source_origin: str = "system",
    ) -> uuid.UUID:
        link_type = await self.lt_repo.get_by_name(user_id, relation)
        if not link_type:
            link_type = await self.lt_repo.create(user_id=user_id, name=relation)
        link = OntologyLink(
            user_id=user_id,
            type_id=link_type.id,
            source_id=source_id,
            target_id=target_id,
            properties=properties or {},
            confidence=confidence,
            source_origin=source_origin,
        )
        await self.link_repo.create(link)
        await self._log_action("create_link", user_id, "system", {"relation": relation}, str(link.id))
        return link.id

    async def create_object_type(self, user_id: uuid.UUID, name: str, parent_category: str, **kwargs) -> None:
        existing = await self.ot_repo.get_by_name(user_id, name)
        if not existing:
            await self.ot_repo.create(user_id=user_id, name=name, parent_category=parent_category, **kwargs)

    async def get_neighbors(self, object_id: uuid.UUID, depth: int = 2) -> list[GraphNode]:
        query = text("""
            WITH RECURSIVE graph AS (
                SELECT o.id, o.name, o.type_id, 0 AS depth
                FROM ontology_objects o
                WHERE o.id = :start_id
                UNION ALL
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
        return [GraphNode(id=r.id, name=r.name, type_id=r.type_id, depth=r.depth) for r in result]

    async def get_full_graph(self, user_id: uuid.UUID) -> GraphData:
        objects = await self.obj_repo.list_by_user(user_id, status="verified")
        links = await self.link_repo.list_by_user(user_id)
        return GraphData(
            nodes=[
                {"id": str(o.id), "name": o.name, "type_id": str(o.type_id), "properties": o.properties}
                for o in objects
            ],
            edges=[
                {"id": str(l.id), "source": str(l.source_id), "target": str(l.target_id),
                 "type_id": str(l.type_id), "properties": l.properties}
                for l in links
            ],
        )

    async def get_stats(self, user_id: uuid.UUID) -> dict:
        all_objects = await self.obj_repo.list_by_user(user_id)
        all_links = await self.link_repo.list_by_user(user_id)
        by_category = await self.obj_repo.count_by_category(user_id)
        draft_count = sum(1 for o in all_objects if o.status == "draft")
        confidences = [o.confidence for o in all_objects]
        return {
            "total_nodes": len(all_objects),
            "total_edges": len(all_links),
            "nodes_by_category": by_category,
            "draft_count": draft_count,
            "avg_confidence": sum(confidences) / len(confidences) if confidences else 0,
        }

    async def generate_embedding(self, text_content: str) -> list[float] | None:
        if self.embedding:
            return await self.embedding.embed(text_content)
        return None

    async def search_relevant(self, user_id: uuid.UUID, query: str, limit: int = 5) -> list[OntologyObject]:
        if not self.embedding:
            return []
        emb = await self.embedding.embed(query)
        if not emb:
            return []
        result = await self.session.execute(
            text("""
                SELECT id, name, type_id, properties, confidence, status
                FROM ontology_objects
                WHERE user_id = :user_id AND status = 'verified' AND embedding IS NOT NULL
                ORDER BY embedding <=> :embedding::vector
                LIMIT :limit
            """),
            {"user_id": user_id, "embedding": str(emb), "limit": limit},
        )
        rows = result.all()
        return [
            OntologyObject(id=r.id, name=r.name, type_id=r.type_id, properties=r.properties,
                           confidence=r.confidence, status=r.status, user_id=user_id, source_type="search")
            for r in rows
        ]

    async def _log_action(
        self, action_name: str, user_id: uuid.UUID, actor: str, params: dict, affected: str
    ) -> None:
        try:
            action_type = await self.at_repo.get_by_name(user_id, action_name)
            if action_type:
                log = OntologyActionLog(
                    action_type_id=action_type.id,
                    user_id=user_id,
                    actor=actor,
                    input_params=params,
                    affected_objects=[affected],
                )
                await self.al_repo.create(log)
        except Exception:
            import logging
            logging.getLogger(__name__).warning("Action log failed for %s", action_name, exc_info=True)
```

- [ ] **Step 3: Run tests**

Run: `cd backend && python -m pytest tests/test_ontology_service.py -v`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/alma/domain/ontology/service.py backend/tests/test_ontology_service.py
git commit -m "feat(ontology): add OntologyService with CRUD + graph queries"
```

---

## Chunk 4: PurificationPipeline + SemanticExtractor

### Task 10: Create PurificationPipeline

**Files:**
- Create: `backend/src/alma/domain/ontology/pipeline.py`

- [ ] **Step 1: Write failing tests**

Add to `backend/tests/test_ontology_pipeline.py`:

```python
from alma.domain.ontology.models import NodeCandidate, RawExtraction
from alma.domain.ontology.pipeline import PurificationPipeline
from alma.domain.ontology.dedup import DeduplicationService
from alma.domain.ontology.validator import SchemaValidator
from alma.domain.ontology.service import OntologyService
from alma.domain.ontology.seed import SystemSeed


@pytest.mark.asyncio
async def test_pipeline_creates_verified_object(db_session: AsyncSession, test_user):
    """confidence >= 0.8 and no dedup match → verified."""
    await SystemSeed(db_session).seed_for_user(test_user.id)
    service = OntologyService(db_session, embedding_provider=None)
    pipeline = PurificationPipeline(
        dedup_service=DeduplicationService(db_session),
        schema_validator=SchemaValidator(),
        ontology_service=service,
    )
    extraction = RawExtraction(
        node_candidates=[
            NodeCandidate(
                name="Learn Rust", parent_category="Action", sub_type="Goal",
                properties={"category": "learning"}, confidence=0.9,
                source_type="goal",
            )
        ],
    )
    result = await pipeline.process(extraction, test_user.id)
    assert len(result.created_objects) == 1
    assert result.rejected_count == 0

    obj = await service.get_object(result.created_objects[0])
    assert obj.status == "verified"


@pytest.mark.asyncio
async def test_pipeline_rejects_low_confidence(db_session: AsyncSession, test_user):
    """confidence < 0.5 → rejected."""
    await SystemSeed(db_session).seed_for_user(test_user.id)
    service = OntologyService(db_session, embedding_provider=None)
    pipeline = PurificationPipeline(
        dedup_service=DeduplicationService(db_session),
        schema_validator=SchemaValidator(),
        ontology_service=service,
    )
    extraction = RawExtraction(
        node_candidates=[
            NodeCandidate(
                name="Maybe Something", parent_category="Concept", sub_type="Topic",
                properties={}, confidence=0.3,
                source_type="llm_extracted",
            )
        ],
    )
    result = await pipeline.process(extraction, test_user.id)
    assert result.rejected_count == 1
    assert len(result.created_objects) == 0


@pytest.mark.asyncio
async def test_pipeline_draft_medium_confidence(db_session: AsyncSession, test_user):
    """0.5 <= confidence < 0.8 → draft."""
    await SystemSeed(db_session).seed_for_user(test_user.id)
    service = OntologyService(db_session, embedding_provider=None)
    pipeline = PurificationPipeline(
        dedup_service=DeduplicationService(db_session),
        schema_validator=SchemaValidator(),
        ontology_service=service,
    )
    extraction = RawExtraction(
        node_candidates=[
            NodeCandidate(
                name="Possible Skill", parent_category="Concept", sub_type="Skill",
                properties={"level": "beginner"}, confidence=0.65,
                source_type="llm_extracted",
            )
        ],
    )
    result = await pipeline.process(extraction, test_user.id)
    assert len(result.review_objects) == 1

    obj = await service.get_object(result.review_objects[0])
    assert obj.status == "draft"
```

- [ ] **Step 2: Implement PurificationPipeline**

Create `backend/src/alma/domain/ontology/pipeline.py`:

```python
import uuid

from alma.config import settings
from alma.domain.ontology.dedup import DeduplicationService
from alma.domain.ontology.models import PurificationResult, RawExtraction
from alma.domain.ontology.service import OntologyService
from alma.domain.ontology.validator import SchemaValidator


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
        result = PurificationResult()

        # Stage 1: Deduplication
        for candidate in extraction.node_candidates:
            if candidate.embedding:
                similar = await self.dedup.find_similar(
                    user_id, candidate.embedding,
                    threshold=settings.ontology_dedup_review_threshold,
                )
                if similar and similar.similarity > settings.ontology_dedup_auto_merge_threshold:
                    candidate.action = "merge"
                    candidate.merge_target_id = similar.object_id
                elif similar:
                    candidate.action = "review"

        # Stage 2: Schema Validation
        for candidate in extraction.node_candidates:
            if candidate.action == "reject":
                continue
            if not self.validator.validate_properties(candidate):
                candidate.action = "reject"
                continue
            # Auto-create new sub_type if needed
            await self.ontology.create_object_type(
                user_id, candidate.sub_type, candidate.parent_category,
                property_schema=self.validator.infer_schema(candidate.properties),
            )

        # Stage 3: Normalization
        for candidate in extraction.node_candidates:
            if candidate.action == "reject":
                continue
            candidate.properties = self.validator.normalize(candidate.properties)

        # Stage 4: Confidence Gate
        for candidate in extraction.node_candidates:
            if candidate.action == "reject":
                result.rejected_count += 1
                continue
            if candidate.confidence < settings.ontology_confidence_reject:
                candidate.action = "reject"
                result.rejected_count += 1
                continue
            if candidate.confidence >= settings.ontology_confidence_auto_verify and candidate.action == "create":
                candidate.status = "verified"
            else:
                candidate.status = "draft"

        # Persist nodes
        for candidate in extraction.node_candidates:
            if candidate.action == "merge" and candidate.merge_target_id:
                await self.ontology.merge_object(candidate.merge_target_id, candidate)
                result.merged_objects.append((candidate.name, candidate.merge_target_id))
            elif candidate.action in ("create", "review"):
                obj_id = await self.ontology.create_object(user_id, candidate)
                if candidate.status == "draft":
                    result.review_objects.append(obj_id)
                else:
                    result.created_objects.append(obj_id)

        # Persist edges
        for edge in extraction.edge_candidates:
            if edge.confidence < settings.ontology_confidence_reject:
                continue
            source_obj = await self.ontology.find_object_by_name(user_id, edge.source_name)
            target_obj = await self.ontology.find_object_by_name(user_id, edge.target_name)
            if source_obj and target_obj:
                link_id = await self.ontology.create_link(
                    user_id, edge.relation, source_obj.id, target_obj.id,
                    edge.properties, edge.confidence, edge.source_origin,
                )
                result.created_links.append(link_id)

        return result
```

- [ ] **Step 3: Run tests**

Run: `cd backend && python -m pytest tests/test_ontology_pipeline.py -v`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/alma/domain/ontology/pipeline.py backend/tests/test_ontology_pipeline.py
git commit -m "feat(ontology): add PurificationPipeline with 4-stage validation"
```

### Task 11: Create SemanticExtractor

**Files:**
- Create: `backend/src/alma/domain/ontology/extractor.py`

- [ ] **Step 1: Write failing test**

Add to `backend/tests/test_ontology_pipeline.py`:

```python
from alma.domain.ontology.extractor import EXTRACTION_SYSTEM_PROMPT


def test_extraction_prompt_contains_categories():
    assert "Entity" in EXTRACTION_SYSTEM_PROMPT
    assert "Action" in EXTRACTION_SYSTEM_PROMPT
    assert "Concept" in EXTRACTION_SYSTEM_PROMPT
    assert "Attribute" in EXTRACTION_SYSTEM_PROMPT
    assert "Temporal" in EXTRACTION_SYSTEM_PROMPT


def test_raw_extraction_from_llm_response():
    from alma.domain.ontology.models import RawExtraction

    json_str = '{"nodes": [{"name": "Python", "parent_category": "Concept", "sub_type": "Skill", "properties": {"level": "intermediate"}, "confidence": 0.9}], "edges": []}'
    result = RawExtraction.from_llm_response(json_str)
    assert len(result.node_candidates) == 1
    assert result.node_candidates[0].name == "Python"
    assert result.node_candidates[0].confidence == 0.9


def test_raw_extraction_from_invalid_json():
    from alma.domain.ontology.models import RawExtraction

    result = RawExtraction.from_llm_response("not json at all")
    assert len(result.node_candidates) == 0
    assert len(result.edge_candidates) == 0
```

- [ ] **Step 2: Implement SemanticExtractor**

Create `backend/src/alma/domain/ontology/extractor.py`:

```python
import json
import uuid

from alma.domain.ontology.models import RawExtraction, SchemaContext
from alma.domain.ontology.service import OntologyService
from alma.infrastructure.llm.base import ChatMessage, LLMRequest
from alma.infrastructure.llm.router import LLMRouter

EXTRACTION_SYSTEM_PROMPT = """
You are an expert at extracting structured knowledge from text.

## Upper Categories
- Entity: things that exist (Person, Project, Organization)
- Action: goals/activities (Goal, Habit, Task)
- Concept: abstract concepts (Topic, Skill, Value)
- Attribute: measurable properties (Metric, Emotion)
- Temporal: time-based (Event, Period)

## Rules
1. Missing is better than ambiguous extraction (exclude if confidence < 0.5)
2. MUST reuse existing node/relationship types if available
3. Create new types only when existing types cannot represent the concept
4. Relationships are directional (source -> relation -> target)
5. If input is Korean, node names should also be Korean

## Output Format (JSON only)
{
  "nodes": [
    {
      "name": "node name",
      "parent_category": "Entity|Action|Concept|Attribute|Temporal",
      "sub_type": "sub type (prefer existing types)",
      "properties": {"key": "value"},
      "confidence": 0.0-1.0
    }
  ],
  "edges": [
    {
      "source_name": "source node name",
      "target_name": "target node name",
      "relation": "relationship type (prefer existing types)",
      "properties": {"key": "value"},
      "confidence": 0.0-1.0
    }
  ]
}
"""


class SemanticExtractor:
    def __init__(self, llm_router: LLMRouter, ontology_service: OntologyService):
        self.llm_router = llm_router
        self.ontology_service = ontology_service

    async def extract(self, text: str, user_id: uuid.UUID) -> RawExtraction:
        context = await self.ontology_service.get_user_schema_context(user_id)

        user_prompt = f"""
Existing Object Types: {context.object_type_names}
Existing Link Types: {context.link_type_names}
Recent nodes (reference): {context.recent_node_names[:20]}

---
Text to extract:
{text}

Respond ONLY in JSON format.
"""
        request = LLMRequest(
            messages=[ChatMessage(role="user", content=user_prompt)],
            system_prompt=EXTRACTION_SYSTEM_PROMPT,
            max_tokens=2048,
            temperature=0.3,
        )
        response = await self.llm_router.complete(request)

        parsed = RawExtraction.from_llm_response(response.content)

        for node in parsed.node_candidates:
            node.embedding = await self.ontology_service.generate_embedding(
                f"{node.name} {node.sub_type} {json.dumps(node.properties, ensure_ascii=False)}"
            )

        return parsed
```

- [ ] **Step 3: Run tests**

Run: `cd backend && python -m pytest tests/test_ontology_pipeline.py -v`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/alma/domain/ontology/extractor.py backend/tests/test_ontology_pipeline.py
git commit -m "feat(ontology): add SemanticExtractor with LLM integration"
```

---

## Chunk 5: Domain Adapters + Event Emissions

### Task 12: Create adapter base + GoalAdapter + HabitAdapter

**Files:**
- Create: `backend/src/alma/domain/ontology/adapters/__init__.py`
- Create: `backend/src/alma/domain/ontology/adapters/base.py`
- Create: `backend/src/alma/domain/ontology/adapters/goal_adapter.py`
- Create: `backend/src/alma/domain/ontology/adapters/habit_adapter.py`
- Test: `backend/tests/test_ontology_adapters.py`

- [ ] **Step 1: Write failing test**

Create `backend/tests/test_ontology_adapters.py`:

```python
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from alma.core.events.models import DomainEvent
from alma.domain.ontology.adapters.goal_adapter import GoalAdapter
from alma.domain.ontology.dedup import DeduplicationService
from alma.domain.ontology.pipeline import PurificationPipeline
from alma.domain.ontology.seed import SystemSeed
from alma.domain.ontology.service import OntologyService
from alma.domain.ontology.validator import SchemaValidator


@pytest.fixture
async def ontology_setup(db_session: AsyncSession, test_user):
    await SystemSeed(db_session).seed_for_user(test_user.id)
    service = OntologyService(db_session, embedding_provider=None)
    pipeline = PurificationPipeline(
        DeduplicationService(db_session), SchemaValidator(), service,
    )
    return service, pipeline


@pytest.mark.asyncio
async def test_goal_adapter_creates_object(db_session, test_user, ontology_setup):
    service, pipeline = ontology_setup
    adapter = GoalAdapter(pipeline, service)

    event = DomainEvent(
        event_type="goal.created",
        source="growth",
        payload={"goal_id": str(uuid.uuid4()), "title": "Learn Rust"},
        user_id=str(test_user.id),
    )
    await adapter.handle(event)

    obj = await service.find_object_by_name(test_user.id, "Learn Rust")
    assert obj is not None
    assert obj.source_type == "goal"
    assert obj.confidence == 1.0
```

- [ ] **Step 2: Create adapter files**

Create `backend/src/alma/domain/ontology/adapters/__init__.py` (empty).

Create `backend/src/alma/domain/ontology/adapters/base.py`:

```python
from alma.domain.ontology.pipeline import PurificationPipeline
from alma.domain.ontology.service import OntologyService


class DomainAdapter:
    def __init__(self, pipeline: PurificationPipeline, ontology: OntologyService):
        self.pipeline = pipeline
        self.ontology = ontology
```

Create `backend/src/alma/domain/ontology/adapters/goal_adapter.py`:

```python
import uuid

from alma.core.events.models import DomainEvent
from alma.domain.ontology.adapters.base import DomainAdapter
from alma.domain.ontology.models import NodeCandidate, RawExtraction


class GoalAdapter(DomainAdapter):
    async def handle(self, event: DomainEvent) -> None:
        p = event.payload
        user_id = uuid.UUID(event.user_id)

        if event.event_type == "goal.created":
            extraction = RawExtraction(
                node_candidates=[
                    NodeCandidate(
                        name=p["title"],
                        parent_category="Action",
                        sub_type="Goal",
                        properties={k: v for k, v in p.items() if k not in ("goal_id", "title")},
                        confidence=1.0,
                        source_type="goal",
                        source_id=uuid.UUID(p["goal_id"]),
                    )
                ],
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

Create `backend/src/alma/domain/ontology/adapters/habit_adapter.py`:

```python
import uuid

from alma.core.events.models import DomainEvent
from alma.domain.ontology.adapters.base import DomainAdapter
from alma.domain.ontology.models import EdgeCandidate, NodeCandidate, RawExtraction


class HabitAdapter(DomainAdapter):
    async def handle(self, event: DomainEvent) -> None:
        p = event.payload
        user_id = uuid.UUID(event.user_id)

        if event.event_type == "habit.created":
            extraction = RawExtraction(
                node_candidates=[
                    NodeCandidate(
                        name=p["title"],
                        parent_category="Action",
                        sub_type="Habit",
                        properties={"frequency": p.get("frequency_type")},
                        confidence=1.0,
                        source_type="habit",
                        source_id=uuid.UUID(p["habit_id"]),
                    )
                ],
            )
            goal_id = p.get("goal_id")
            if goal_id:
                goal_obj = await self.ontology.find_by_source("goal", uuid.UUID(goal_id))
                if goal_obj:
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

- [ ] **Step 3: Run tests**

Run: `cd backend && python -m pytest tests/test_ontology_adapters.py -v`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/alma/domain/ontology/adapters/ backend/tests/test_ontology_adapters.py
git commit -m "feat(ontology): add GoalAdapter + HabitAdapter"
```

### Task 13: Create ChatAdapter + MemoryAdapter + KnowledgeAdapter

**Files:**
- Create: `backend/src/alma/domain/ontology/adapters/chat_adapter.py`
- Create: `backend/src/alma/domain/ontology/adapters/memory_adapter.py`
- Create: `backend/src/alma/domain/ontology/adapters/knowledge_adapter.py`

- [ ] **Step 1: Create ChatAdapter**

Create `backend/src/alma/domain/ontology/adapters/chat_adapter.py`:

```python
import re
import uuid

from alma.config import settings
from alma.core.events.models import DomainEvent
from alma.domain.ontology.extractor import SemanticExtractor
from alma.domain.ontology.pipeline import PurificationPipeline

SKIP_PATTERNS = re.compile(
    r"^(네|예|아니요|알겠|좋아|감사|ㅇㅇ|ㅋ|ㅎ|ok|yes|no|thanks|sure)",
    re.IGNORECASE,
)


class ChatAdapter:
    def __init__(self, extractor: SemanticExtractor, pipeline: PurificationPipeline):
        self.extractor = extractor
        self.pipeline = pipeline

    async def handle(self, event: DomainEvent) -> None:
        p = event.payload
        if p.get("role") != "user":
            return

        content = p.get("content", "")
        if len(content) < settings.ontology_chat_min_length:
            return
        if SKIP_PATTERNS.match(content.strip()):
            return

        user_id = uuid.UUID(event.user_id)
        extraction = await self.extractor.extract(content, user_id)
        if extraction.node_candidates or extraction.edge_candidates:
            await self.pipeline.process(extraction, user_id)
```

- [ ] **Step 2: Create MemoryAdapter**

Create `backend/src/alma/domain/ontology/adapters/memory_adapter.py`:

```python
import uuid

from alma.core.events.models import DomainEvent
from alma.domain.ontology.adapters.base import DomainAdapter
from alma.domain.ontology.models import NodeCandidate, RawExtraction


class MemoryAdapter(DomainAdapter):
    async def handle(self, event: DomainEvent) -> None:
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
        )
        await self.pipeline.process(extraction, user_id)
```

- [ ] **Step 3: Create KnowledgeAdapter**

Create `backend/src/alma/domain/ontology/adapters/knowledge_adapter.py`:

```python
import uuid

from alma.core.events.models import DomainEvent
from alma.domain.ontology.extractor import SemanticExtractor
from alma.domain.ontology.pipeline import PurificationPipeline


class KnowledgeAdapter:
    def __init__(self, extractor: SemanticExtractor, pipeline: PurificationPipeline):
        self.extractor = extractor
        self.pipeline = pipeline

    async def handle(self, event: DomainEvent) -> None:
        p = event.payload
        user_id = uuid.UUID(event.user_id)
        extraction = await self.extractor.extract(
            f"Document: {p['title']}\n{p.get('content', '')[:2000]}",
            user_id,
        )
        for node in extraction.node_candidates:
            node.source_type = "knowledge"
            node.source_id = uuid.UUID(p["document_id"])
        await self.pipeline.process(extraction, user_id)
```

- [ ] **Step 4: Write adapter tests**

Add to `backend/tests/test_ontology_adapters.py`:

```python
from alma.domain.ontology.adapters.chat_adapter import ChatAdapter, SKIP_PATTERNS
from alma.domain.ontology.adapters.memory_adapter import MemoryAdapter


def test_skip_patterns_matches_short_responses():
    assert SKIP_PATTERNS.match("네 알겠습니다")
    assert SKIP_PATTERNS.match("ok")
    assert SKIP_PATTERNS.match("감사합니다")
    assert not SKIP_PATTERNS.match("내일 운동을 시작하려고 하는데 어떤 루틴이 좋을까?")


@pytest.mark.asyncio
async def test_chat_adapter_skips_short_message(db_session, test_user, ontology_setup):
    """Messages under 30 chars should be skipped."""
    service, pipeline = ontology_setup
    # ChatAdapter requires extractor, but short messages skip extraction
    # So we can pass None and it won't be called
    adapter = ChatAdapter(extractor=None, pipeline=pipeline)

    event = DomainEvent(
        event_type="message.received",
        source="chat",
        payload={"role": "user", "content": "네"},
        user_id=str(test_user.id),
    )
    await adapter.handle(event)  # should not raise


@pytest.mark.asyncio
async def test_chat_adapter_skips_assistant_message(db_session, test_user, ontology_setup):
    """Assistant messages should be skipped."""
    service, pipeline = ontology_setup
    adapter = ChatAdapter(extractor=None, pipeline=pipeline)

    event = DomainEvent(
        event_type="message.received",
        source="chat",
        payload={"role": "assistant", "content": "Here is a long response about many things"},
        user_id=str(test_user.id),
    )
    await adapter.handle(event)  # should not raise


@pytest.mark.asyncio
async def test_memory_adapter_creates_object(db_session, test_user, ontology_setup):
    service, pipeline = ontology_setup
    adapter = MemoryAdapter(pipeline, service)

    event = DomainEvent(
        event_type="memory.created",
        source="memory",
        payload={
            "memory_id": str(uuid.uuid4()),
            "content": "User prefers dark mode and minimal UI",
            "category": "preference",
        },
        user_id=str(test_user.id),
    )
    await adapter.handle(event)

    # Check that an object was created (may be in verified or draft state)
    objects = await service.obj_repo.list_by_user(test_user.id)
    memory_objs = [o for o in objects if o.source_type == "memory"]
    assert len(memory_objs) == 1
```

- [ ] **Step 5: Run adapter tests**

Run: `cd backend && python -m pytest tests/test_ontology_adapters.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/alma/domain/ontology/adapters/ backend/tests/test_ontology_adapters.py
git commit -m "feat(ontology): add ChatAdapter + MemoryAdapter + KnowledgeAdapter with tests"
```

### Task 14: Add missing event emissions to existing services

**Files:**
- Modify: `backend/src/alma/domain/growth/service.py`
- Modify: `backend/src/alma/domain/memory/service.py`
- Modify: `backend/src/alma/domain/knowledge/service.py`

- [ ] **Step 1: Add goal.updated and goal.deleted emissions**

In `backend/src/alma/domain/growth/service.py`, find `update_goal` and `delete_goal` methods. Add emit calls following the existing pattern in `create_goal`:

```python
# In update_goal method, after await self.goal_repo.update(goal):
try:
    from alma.core.events.helpers import emit
    await emit(
        "goal.updated", "growth",
        {"goal_id": str(goal.id), "changed": changed_fields},
        user_id=str(goal.user_id), aggregate_id=str(goal.id),
    )
except Exception:
    pass

# In delete_goal method, after await self.goal_repo.delete(goal_id):
try:
    from alma.core.events.helpers import emit
    await emit(
        "goal.deleted", "growth",
        {"goal_id": str(goal_id)},
    )
except Exception:
    pass
```

- [ ] **Step 2: Add memory.created emission**

In `backend/src/alma/domain/memory/service.py`, find `store_memory` or equivalent method. Add:

```python
try:
    from alma.core.events.helpers import emit
    await emit(
        "memory.created", "memory",
        {"memory_id": str(memory.id), "content": memory.content, "category": memory.category},
        user_id=str(user_id), aggregate_id=str(memory.id),
    )
except Exception:
    pass
```

- [ ] **Step 3: Add knowledge.document_ready emission**

In `backend/src/alma/domain/knowledge/service.py`, find where document status changes to "ready". Add:

```python
try:
    from alma.core.events.helpers import emit
    await emit(
        "knowledge.document_ready", "knowledge",
        {"document_id": str(doc.id), "title": doc.title, "content": doc.content[:2000]},
        user_id=str(user_id), aggregate_id=str(doc.id),
    )
except Exception:
    pass
```

- [ ] **Step 4: Run existing tests to verify no regressions**

Run: `cd backend && python -m pytest tests/ -v --timeout=30`
Expected: All existing tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/alma/domain/growth/service.py backend/src/alma/domain/memory/service.py backend/src/alma/domain/knowledge/service.py
git commit -m "feat(ontology): add missing event emissions for adapter integration"
```

---

## Chunk 6: REST API + main.py Integration

> **Note**: Chunks 6-8 provide task structure and guidance. The implementing agent should reference the spec (`docs/superpowers/specs/2026-03-27-ontology-core-design.md`) sections 9-14 for detailed schemas, response models, and migration logic. Follow existing patterns in `api/goals.py` for API, `components/` for frontend.

### Task 15: Create ontology REST API router

**Files:**
- Create: `backend/src/alma/api/ontology.py`
- Test: `backend/tests/test_ontology_api.py`

- [ ] **Step 1: Implement API router**

Create `backend/src/alma/api/ontology.py` following the existing router pattern (see `api/goals.py`). Include:
- Pydantic request/response schemas
- 15 endpoints from spec section 9
- Dependency injection for OntologyService
- Helper functions for ORM → Pydantic conversion

Key endpoints:
- `GET /api/ontology/types` — list object + link types
- `GET /api/ontology/objects` — list with filters (type, status, category)
- `GET /api/ontology/objects/{id}` — detail with links
- `GET /api/ontology/objects/{id}/neighbors` — N-hop graph query
- `POST /api/ontology/objects/{id}/verify` — draft → verified
- `POST /api/ontology/objects/{id}/merge` — merge duplicate
- `GET /api/ontology/graph` — full graph for visualization
- `POST /api/ontology/extract/preview` — LLM extraction preview
- `GET /api/ontology/stats` — statistics

- [ ] **Step 2: Write API tests**

Create `backend/tests/test_ontology_api.py` with tests for:
- List types (after seed)
- Create + get object
- Verify object
- Get graph
- Get stats

- [ ] **Step 3: Run tests**

Run: `cd backend && python -m pytest tests/test_ontology_api.py -v`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/alma/api/ontology.py backend/tests/test_ontology_api.py
git commit -m "feat(ontology): add REST API router (15 endpoints)"
```

### Task 16: Register router + adapters in main.py

**Files:**
- Modify: `backend/src/alma/main.py`
- Modify: `backend/src/alma/domain/chat/service.py`

- [ ] **Step 1: Add imports and adapter registration to main.py**

```python
# Add imports
from alma.api.ontology import router as ontology_router

# Add router
app.include_router(ontology_router)

# Add adapter event subscriptions (after existing event_bus subscriptions)
# Note: Adapters are initialized lazily to avoid import issues
# Full adapter wiring will be done when session factory is available
```

- [ ] **Step 2: Add ontology context to ChatService**

In `backend/src/alma/domain/chat/service.py`, add optional `ontology_service` parameter and inject ontology context into LLM prompts.

- [ ] **Step 3: Run all tests**

Run: `cd backend && python -m pytest tests/ -v --timeout=30`
Expected: All PASS

- [ ] **Step 4: Lint check**

Run: `cd backend && ruff check src/ tests/ && ruff format src/ tests/`

- [ ] **Step 5: Commit**

```bash
git add backend/src/alma/main.py backend/src/alma/domain/chat/service.py
git commit -m "feat(ontology): register router + adapter subscriptions in main.py"
```

---

## Chunk 7: Frontend

### Task 17: Add ontology types and API hooks

**Files:**
- Modify: `frontend/lib/types.ts`
- Create: `frontend/hooks/useOntology.ts`

- [ ] **Step 1: Add TypeScript types**
- [ ] **Step 2: Create API hooks**
- [ ] **Step 3: Commit**

### Task 18: Create ontology management page

**Files:**
- Create: `frontend/app/ontology/page.tsx`
- Create: `frontend/components/ontology/OntologyStats.tsx`
- Create: `frontend/components/ontology/ObjectList.tsx`
- Create: `frontend/components/ontology/ObjectDetail.tsx`
- Create: `frontend/components/ontology/DraftReview.tsx`
- Create: `frontend/components/ontology/ManualExtract.tsx`
- Modify: `frontend/components/common/NavBar.tsx`
- Modify: `frontend/middleware.ts`

- [ ] **Step 1: Create components**
- [ ] **Step 2: Add nav tab + middleware protection**
- [ ] **Step 3: Test in browser**
- [ ] **Step 4: Commit**

---

## Chunk 8: Existing Data Migration + Final Verification

### Task 19: Create data migration script

**Files:**
- Create: Alembic data migration

- [ ] **Step 1: Create migration for existing data**

Migrate existing Goals, Habits, UserMemories, GoalConversationLinks into ontology objects and links.

- [ ] **Step 2: Run migration**
- [ ] **Step 3: Verify data integrity**
- [ ] **Step 4: Commit**

### Task 20: Final integration test + lint

- [ ] **Step 1: Run full test suite**

```bash
cd backend && python -m pytest tests/ -v --timeout=60
```

- [ ] **Step 2: Lint**

```bash
cd backend && ruff check src/ tests/ && ruff format --check src/ tests/
```

- [ ] **Step 3: Frontend build check**

```bash
cd frontend && npm run build && npm run lint
```

- [ ] **Step 4: Final commit**

```bash
git commit -m "feat(ontology): Phase A complete - ontology core with adapters and API"
```
