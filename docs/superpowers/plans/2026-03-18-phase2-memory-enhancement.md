# Phase 2: Memory Enhancement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ALMA가 대화를 기억하고, 과거 맥락을 벡터 검색으로 활용하며, 사용자를 점진적으로 학습하는 메모리 시스템을 구축한다.

**Architecture:** Claude Memory Tool 패턴 참고 — 구조화된 메모리(user_memories 테이블) + 벡터 검색 + just-in-time context retrieval. EmbeddingProvider Protocol로 Gemini/OpenAI 교체 가능. 사용자 프로필은 명시적 설정(preferences) + 대화 기반 암묵적 학습(BackgroundTasks).

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, pgvector (Vector 768), google-generativeai (asyncio.to_thread), openai SDK, Alembic, pytest-asyncio, Next.js 14 (IntersectionObserver)

**Spec:** `docs/superpowers/specs/2026-03-18-phase2-memory-enhancement.md`

**Prerequisites Check:**
- [ ] Supabase DB 연결 확인: `DATABASE_URL` 환경변수
- [ ] Python venv 활성화: `source .venv/Scripts/activate`
- [ ] 기존 17개 테스트 통과: `pytest tests/ -v`
- [ ] Gemini API Key (임베딩용, 선택): `GEMINI_API_KEY`

---

## File Structure

### Backend — New Files

| Path | Responsibility |
|------|---------------|
| `src/alma/models/models.py` | MODIFY: UserMemory 모델 추가, Message.embedding Vector(768) 변경 |
| `src/alma/domain/memory/embedding.py` | CREATE: EmbeddingProvider Protocol + Gemini/OpenAI 구현 |
| `src/alma/domain/memory/models.py` | CREATE: SearchQuery, SearchResult 값 객체 |
| `src/alma/domain/memory/service.py` | MODIFY: EmbeddingProvider 의존성 주입 |
| `src/alma/domain/memory/repository.py` | CREATE: UserMemoryRepository |
| `src/alma/domain/identity/profile.py` | CREATE: UserProfileService |
| `src/alma/domain/chat/service.py` | MODIFY: 프로필 학습 트리거 + preferences 주입 |
| `src/alma/domain/chat/repository.py` | MODIFY: get_messages_paginated() 추가 |
| `src/alma/api/messages.py` | CREATE: 메시지 히스토리 API |
| `src/alma/api/profile.py` | CREATE: 프로필 API |
| `src/alma/main.py` | MODIFY: 새 라우터 등록 |
| `alembic/versions/*_vector_768.py` | CREATE: 마이그레이션 |
| `tests/test_embedding.py` | CREATE: EmbeddingProvider 테스트 |
| `tests/test_messages_api.py` | CREATE: 메시지 API 테스트 |
| `tests/test_profile.py` | CREATE: 프로필 테스트 |
| `tests/test_user_memory.py` | CREATE: UserMemory 테스트 |

### Frontend — Modified Files

| Path | Responsibility |
|------|---------------|
| `src/components/ChatWindow.tsx` | MODIFY: 히스토리 로드 + 무한 스크롤 |
| `src/lib/api.ts` | MODIFY: 메시지 API 호출 추가 |

---

## Chunk 1: DB 마이그레이션 + EmbeddingProvider

### Task 1: Vector 차원 변경 + UserMemory 모델

**Files:**
- Modify: `backend/src/alma/models/models.py`
- Create: `backend/alembic/versions/*_vector_768_user_memories.py`

- [ ] **Step 1: models.py에 UserMemory 추가 + Vector(768) 변경**

```python
# backend/src/alma/models/models.py — Message 클래스의 embedding 변경
# 기존: embedding = mapped_column(Vector(1536), nullable=True)
# 변경:
embedding = mapped_column(Vector(768), nullable=True)
```

```python
# backend/src/alma/models/models.py — 파일 끝에 추가
class UserMemory(Base):
    __tablename__ = "user_memories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    category: Mapped[str] = mapped_column(nullable=False)  # preference, fact, pattern
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(Vector(768), nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_user_memories_user", "user_id", "category"),
        Index(
            "idx_user_memories_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )
```

- [ ] **Step 2: Alembic 마이그레이션 수동 작성**

```python
# backend/alembic/versions/XXXX_vector_768_user_memories.py
"""vector 768 and user_memories table

Revision ID: (auto)
"""
import pgvector.sqlalchemy.vector
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

def upgrade() -> None:
    # 1. Drop HNSW index on messages
    op.drop_index("idx_messages_embedding", table_name="messages")
    # 2. Change vector dimension
    op.alter_column("messages", "embedding",
        type_=pgvector.sqlalchemy.vector.VECTOR(dim=768),
        existing_nullable=True)
    # 3. Recreate HNSW index
    op.create_index("idx_messages_embedding", "messages", ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"})
    # 4. Create user_memories table
    op.create_table("user_memories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", pgvector.sqlalchemy.vector.VECTOR(dim=768), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_user_memories_user", "user_memories", ["user_id", "category"])
    op.create_index("idx_user_memories_embedding", "user_memories", ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"})

def downgrade() -> None:
    op.drop_table("user_memories")
    op.drop_index("idx_messages_embedding", table_name="messages")
    op.alter_column("messages", "embedding",
        type_=pgvector.sqlalchemy.vector.VECTOR(dim=1536),
        existing_nullable=True)
    op.create_index("idx_messages_embedding", "messages", ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"})
```

- [ ] **Step 3: 마이그레이션 실행**

```bash
DATABASE_URL="postgresql+asyncpg://..." alembic upgrade head
```

Expected: 성공, user_memories 테이블 생성, messages.embedding Vector(768) 변경

- [ ] **Step 4: 기존 테스트 통과 확인**

```bash
DATABASE_URL="..." TEST_DATABASE_URL="..." pytest tests/ -v
```

Expected: 17 passed

- [ ] **Step 5: Commit**

```bash
git add backend/src/alma/models/models.py backend/alembic/versions/
git commit -m "feat: Vector(768) 마이그레이션 + UserMemory 모델 추가"
```

---

### Task 2: EmbeddingProvider Protocol

**Files:**
- Create: `backend/src/alma/domain/memory/embedding.py`
- Create: `backend/src/alma/domain/memory/models.py`
- Create: `backend/tests/test_embedding.py`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
# backend/tests/test_embedding.py
import pytest
from alma.domain.memory.embedding import (
    GeminiEmbedding, OpenAIEmbedding, create_embedding_provider,
)
from alma.domain.memory.models import SearchQuery, SearchResult
from alma.infrastructure.llm.base import ChatMessage


def test_search_query_creation():
    q = SearchQuery(user_id="abc", query="hello")
    assert q.limit == 5


def test_search_result_creation():
    r = SearchResult(
        messages=[ChatMessage(role="user", content="hi")],
        scores=[0.1],
    )
    assert len(r.messages) == 1


def test_create_embedding_provider_none():
    """API 키 없으면 None 반환"""
    from unittest.mock import MagicMock
    settings = MagicMock()
    settings.gemini_api_key = ""
    settings.openai_api_key = ""
    provider = create_embedding_provider(settings)
    assert provider is None
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/test_embedding.py -v
```

Expected: FAIL (import error)

- [ ] **Step 3: models.py 구현**

```python
# backend/src/alma/domain/memory/models.py
from dataclasses import dataclass
from alma.infrastructure.llm.base import ChatMessage


@dataclass(frozen=True)
class SearchQuery:
    user_id: str
    query: str
    limit: int = 5


@dataclass(frozen=True)
class SearchResult:
    messages: list[ChatMessage]
    scores: list[float]
```

- [ ] **Step 4: embedding.py 구현**

```python
# backend/src/alma/domain/memory/embedding.py
import asyncio
import logging
from typing import Protocol

logger = logging.getLogger(__name__)

EMBEDDING_DIMENSIONS = 768


class EmbeddingProvider(Protocol):
    async def embed(self, text: str) -> list[float] | None: ...

    @property
    def dimensions(self) -> int: ...


class GeminiEmbedding:
    dimensions = 768

    def __init__(self, api_key: str):
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        self._genai = genai

    async def embed(self, text: str) -> list[float] | None:
        try:
            result = await asyncio.to_thread(
                self._genai.embed_content,
                model="models/text-embedding-004",
                content=text,
            )
            return result["embedding"]
        except Exception:
            logger.warning("Gemini embedding failed", exc_info=True)
            return None


class OpenAIEmbedding:
    dimensions = 768

    def __init__(self, api_key: str):
        import openai
        self._client = openai.AsyncOpenAI(api_key=api_key)

    async def embed(self, text: str) -> list[float] | None:
        try:
            response = await self._client.embeddings.create(
                model="text-embedding-3-small", input=text, dimensions=768,
            )
            return response.data[0].embedding
        except Exception:
            logger.warning("OpenAI embedding failed", exc_info=True)
            return None


def create_embedding_provider(settings) -> EmbeddingProvider | None:
    if settings.gemini_api_key:
        return GeminiEmbedding(settings.gemini_api_key)
    if settings.openai_api_key:
        return OpenAIEmbedding(settings.openai_api_key)
    return None
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
pytest tests/test_embedding.py -v
```

Expected: 3 passed

- [ ] **Step 6: MemoryService 리팩토링 — EmbeddingProvider 주입**

```python
# backend/src/alma/domain/memory/service.py — 수정
# __init__에 embedding_provider 파라미터 추가
# _get_embedding에서 provider 사용
class MemoryService:
    def __init__(self, session: AsyncSession, embedding_provider: EmbeddingProvider | None = None):
        self.session = session
        self.embedding_provider = embedding_provider
        self.message_repo = MessageRepository(session)
        self.conversation_repo = ConversationRepository(session)

    async def _get_embedding(self, text: str) -> list[float] | None:
        if self.embedding_provider is None:
            return None
        return await self.embedding_provider.embed(text)
```

- [ ] **Step 7: ChatService + WebSocket에서 provider 전달**

```python
# backend/src/alma/domain/chat/service.py — 수정
from alma.domain.memory.embedding import create_embedding_provider
from alma.config import settings

class ChatService:
    def __init__(self, session: AsyncSession, llm: LLMProvider):
        self.session = session
        self.llm = llm
        embedding_provider = create_embedding_provider(settings)
        self.memory = MemoryService(session, embedding_provider)
        self.integration = IntegrationService(session, llm)
```

- [ ] **Step 8: 전체 테스트 통과**

```bash
DATABASE_URL="..." TEST_DATABASE_URL="..." pytest tests/ -v
```

Expected: 17+ passed

- [ ] **Step 9: Commit**

```bash
git add backend/src/alma/domain/memory/ backend/src/alma/domain/chat/service.py backend/tests/test_embedding.py
git commit -m "feat: EmbeddingProvider Protocol + MemoryService 리팩토링"
```

---

## Chunk 2: 대화 지속성 API + Frontend

### Task 3: 메시지 페이지네이션 API

**Files:**
- Modify: `backend/src/alma/domain/chat/repository.py`
- Create: `backend/src/alma/api/messages.py`
- Modify: `backend/src/alma/main.py`
- Create: `backend/tests/test_messages_api.py`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
# backend/tests/test_messages_api.py
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from alma.domain.identity.service import create_access_token, hash_password
from alma.main import app
from alma.models.models import User, Conversation, Message


@pytest.mark.asyncio
async def test_get_messages_empty(db_session):
    user = User(email=f"msg_{uuid.uuid4().hex[:8]}@test.com", password_hash=hash_password("pass"))
    db_session.add(user)
    await db_session.flush()
    conv = Conversation(user_id=user.id)
    db_session.add(conv)
    await db_session.flush()

    token = create_access_token(str(user.id))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            f"/api/conversations/{conv.id}/messages",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["messages"] == []
    assert data["has_more"] is False


@pytest.mark.asyncio
async def test_get_messages_other_user_404(db_session):
    user1 = User(email=f"u1_{uuid.uuid4().hex[:8]}@test.com", password_hash=hash_password("pass"))
    user2 = User(email=f"u2_{uuid.uuid4().hex[:8]}@test.com", password_hash=hash_password("pass"))
    db_session.add_all([user1, user2])
    await db_session.flush()
    conv = Conversation(user_id=user1.id)
    db_session.add(conv)
    await db_session.flush()

    token = create_access_token(str(user2.id))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            f"/api/conversations/{conv.id}/messages",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 404
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/test_messages_api.py -v
```

Expected: FAIL

- [ ] **Step 3: Repository에 get_messages_paginated 추가**

```python
# backend/src/alma/domain/chat/repository.py — MessageRepository에 추가
async def get_messages_paginated(
    self, conversation_id: uuid.UUID, limit: int = 20, before_id: uuid.UUID | None = None,
) -> tuple[list[Message], bool]:
    query = select(Message).where(Message.conversation_id == conversation_id)
    if before_id:
        subq = select(Message.created_at).where(Message.id == before_id).scalar_subquery()
        query = query.where(Message.created_at < subq)
    query = query.order_by(desc(Message.created_at)).limit(limit + 1)
    result = await self.session.execute(query)
    rows = list(result.scalars().all())
    has_more = len(rows) > limit
    messages = rows[:limit]
    messages.reverse()  # ASC order
    return messages, has_more
```

- [ ] **Step 4: API 라우터 구현**

```python
# backend/src/alma/api/messages.py
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.dependencies import get_current_user
from alma.database import get_session
from alma.models.models import Conversation, User
from alma.domain.chat.repository import MessageRepository

router = APIRouter(prefix="/api/conversations", tags=["messages"])


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: str


class MessagesPageResponse(BaseModel):
    messages: list[MessageResponse]
    has_more: bool


@router.get("/{conversation_id}/messages", response_model=MessagesPageResponse)
async def get_messages(
    conversation_id: uuid.UUID,
    limit: int = Query(default=20, le=100),
    before: uuid.UUID | None = Query(default=None),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    # 소유권 검증
    result = await session.execute(
        select(Conversation).where(
            Conversation.id == conversation_id, Conversation.user_id == user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Conversation not found")

    repo = MessageRepository(session)
    messages, has_more = await repo.get_messages_paginated(conversation_id, limit, before)
    return MessagesPageResponse(
        messages=[
            MessageResponse(id=str(m.id), role=m.role, content=m.content, created_at=m.created_at.isoformat())
            for m in messages
        ],
        has_more=has_more,
    )
```

- [ ] **Step 5: main.py에 라우터 등록**

```python
# backend/src/alma/main.py — 추가
from alma.api.messages import router as messages_router
app.include_router(messages_router)
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
pytest tests/test_messages_api.py -v
```

Expected: 2 passed

- [ ] **Step 7: Commit**

```bash
git add backend/src/alma/domain/chat/repository.py backend/src/alma/api/messages.py backend/src/alma/main.py backend/tests/test_messages_api.py
git commit -m "feat: 메시지 페이지네이션 API + 소유권 검증"
```

---

### Task 4: Frontend 대화 히스토리 + 무한 스크롤

**Files:**
- Modify: `frontend/src/components/ChatWindow.tsx`

- [ ] **Step 1: ChatWindow에 히스토리 로드 + 무한 스크롤 구현**

```typescript
// frontend/src/components/ChatWindow.tsx
// 대화 선택 시 GET /api/conversations/{id}/messages 호출
// IntersectionObserver로 위로 스크롤 감지
// before 파라미터로 이전 메시지 추가 로드
```

핵심 변경:
- `useEffect`에서 `conversationId` 변경 시 히스토리 로드
- `loadMoreRef` + `IntersectionObserver`로 스크롤 감지
- `hasMore` 상태로 추가 로드 여부 관리
- WebSocket 메시지와 히스토리 메시지 병합

- [ ] **Step 2: 브라우저 테스트**

1. 서버 시작: `uvicorn alma.main:app --port 8000`
2. 프론트엔드: `npm run dev`
3. 로그인 → 기존 대화 선택 → 이전 메시지 표시 확인
4. 위로 스크롤 → 이전 메시지 추가 로드 확인

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChatWindow.tsx
git commit -m "feat: 대화 히스토리 로드 + 무한 스크롤"
```

---

## Chunk 3: 사용자 프로필 학습

### Task 5: UserProfileService + API

**Files:**
- Create: `backend/src/alma/domain/identity/profile.py`
- Create: `backend/src/alma/api/profile.py`
- Modify: `backend/src/alma/main.py`
- Create: `backend/tests/test_profile.py`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
# backend/tests/test_profile.py
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from alma.domain.identity.service import create_access_token, hash_password
from alma.main import app
from alma.models.models import User


@pytest.mark.asyncio
async def test_get_preferences(db_session):
    user = User(email=f"pref_{uuid.uuid4().hex[:8]}@test.com", password_hash=hash_password("pass"))
    db_session.add(user)
    await db_session.flush()

    token = create_access_token(str(user.id))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/users/me/preferences", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["language"] == "ko"


@pytest.mark.asyncio
async def test_update_preferences(db_session):
    user = User(email=f"pref2_{uuid.uuid4().hex[:8]}@test.com", password_hash=hash_password("pass"))
    db_session.add(user)
    await db_session.flush()

    token = create_access_token(str(user.id))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.put(
            "/api/users/me/preferences",
            headers={"Authorization": f"Bearer {token}"},
            json={"language": "en", "response_style": "detailed", "interests": ["tech"]},
        )
    assert resp.status_code == 200
    assert resp.json()["language"] == "en"


@pytest.mark.asyncio
async def test_put_ignores_learned_field(db_session):
    user = User(email=f"pref3_{uuid.uuid4().hex[:8]}@test.com", password_hash=hash_password("pass"))
    db_session.add(user)
    await db_session.flush()

    token = create_access_token(str(user.id))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.put(
            "/api/users/me/preferences",
            headers={"Authorization": f"Bearer {token}"},
            json={"language": "ko", "learned": {"injected": True}},
        )
        resp = await client.get("/api/users/me/preferences", headers={"Authorization": f"Bearer {token}"})
    # learned는 서버 전용이므로 injected가 없어야 함
    assert "injected" not in resp.json().get("learned", {})
```

- [ ] **Step 2: ProfileService 구현**

```python
# backend/src/alma/domain/identity/profile.py
from sqlalchemy.ext.asyncio import AsyncSession
from alma.domain.identity.repository import UserRepository

DEFAULT_PREFERENCES = {
    "language": "ko",
    "response_style": "concise",
    "interests": [],
    "timezone": "Asia/Seoul",
    "learned": {},
}


class UserProfileService:
    def __init__(self, session: AsyncSession):
        self.user_repo = UserRepository(session)
        self.session = session

    async def get_preferences(self, user_id: str) -> dict:
        user = await self.user_repo.find_by_id(uuid.UUID(user_id))
        if not user:
            return dict(DEFAULT_PREFERENCES)
        merged = dict(DEFAULT_PREFERENCES)
        merged.update(user.preferences or {})
        return merged

    async def update_preferences(self, user_id: str, prefs: dict) -> dict:
        user = await self.user_repo.find_by_id(uuid.UUID(user_id))
        if not user:
            raise ValueError("User not found")
        current = dict(user.preferences or {})
        # learned 필드는 서버 전용 — PUT에서 무시
        prefs.pop("learned", None)
        current.update(prefs)
        user.preferences = current
        await self.session.commit()
        await self.session.refresh(user)
        merged = dict(DEFAULT_PREFERENCES)
        merged.update(user.preferences)
        return merged
```

- [ ] **Step 3: API 라우터 구현**

```python
# backend/src/alma/api/profile.py
import uuid
from typing import Literal
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from alma.auth.dependencies import get_current_user
from alma.database import get_session
from alma.models.models import User
from alma.domain.identity.profile import UserProfileService

router = APIRouter(prefix="/api/users/me", tags=["profile"])


class PreferencesUpdate(BaseModel):
    language: Literal["ko", "en", "ja"] = "ko"
    response_style: Literal["concise", "detailed", "casual"] = "concise"
    interests: list[str] = []
    timezone: str = "Asia/Seoul"


@router.get("/preferences")
async def get_preferences(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    service = UserProfileService(session)
    return await service.get_preferences(str(user.id))


@router.put("/preferences")
async def update_preferences(
    body: PreferencesUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    service = UserProfileService(session)
    return await service.update_preferences(str(user.id), body.model_dump())
```

- [ ] **Step 4: main.py에 라우터 등록**

```python
from alma.api.profile import router as profile_router
app.include_router(profile_router)
```

- [ ] **Step 5: 테스트 통과**

```bash
pytest tests/test_profile.py -v
```

Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add backend/src/alma/domain/identity/profile.py backend/src/alma/api/profile.py backend/src/alma/main.py backend/tests/test_profile.py
git commit -m "feat: 사용자 프로필 API (GET/PUT preferences)"
```

---

### Task 6: ChatService에 프로필 연동 + 암묵적 학습

**Files:**
- Modify: `backend/src/alma/domain/chat/service.py`
- Modify: `backend/src/alma/domain/identity/profile.py`

- [ ] **Step 1: ChatService에 preferences system prompt 주입**

```python
# domain/chat/service.py — process_message 내
# 사용자 선호도를 system prompt에 안전하게 주입
import json
from alma.domain.identity.profile import UserProfileService

profile_service = UserProfileService(session)
preferences = await profile_service.get_preferences(user_id)
safe_prefs = {
    "language": preferences.get("language", "ko"),
    "response_style": preferences.get("response_style", "concise"),
    "interests": preferences.get("interests", [])[:10],
}
personalized_prompt = SYSTEM_PROMPT + f"\n\nUser preferences: {json.dumps(safe_prefs)}"
```

- [ ] **Step 2: 암묵적 학습 트리거 (BackgroundTasks)**

```python
# domain/identity/profile.py — extract_from_conversation 추가
async def extract_from_conversation(
    self, user_id: str, messages: list[ChatMessage], llm: LLMProvider,
) -> None:
    """LLM으로 대화에서 사용자 선호도 추출. BackgroundTask로 호출."""
    prompt = """Analyze this conversation and extract user preferences as JSON.
Return ONLY valid JSON: {"topics_discussed": [...], "communication_pattern": "..."}
If nothing notable, return: {}"""
    # ... LLM 호출 → preferences.learned에 병합
```

- [ ] **Step 3: 전체 테스트 통과**

```bash
DATABASE_URL="..." TEST_DATABASE_URL="..." pytest tests/ -v
```

Expected: 전체 통과

- [ ] **Step 4: Commit**

```bash
git add backend/src/alma/domain/chat/service.py backend/src/alma/domain/identity/profile.py
git commit -m "feat: 프로필 기반 system prompt 개인화 + 암묵적 학습 트리거"
```

---

## Chunk 4: UserMemory + 통합 검증

### Task 7: UserMemoryRepository + MemoryService 확장

**Files:**
- Create: `backend/src/alma/domain/memory/repository.py`
- Modify: `backend/src/alma/domain/memory/service.py`
- Create: `backend/tests/test_user_memory.py`

- [ ] **Step 1: 테스트 작성**

```python
# backend/tests/test_user_memory.py
import uuid
import pytest
from alma.models.models import User, UserMemory
from alma.domain.memory.repository import UserMemoryRepository


@pytest.mark.asyncio
async def test_create_and_search_memory(db_session):
    user = User(email=f"mem_{uuid.uuid4().hex[:8]}@test.com", password_hash="hashed")
    db_session.add(user)
    await db_session.flush()

    repo = UserMemoryRepository(db_session)
    await repo.create(user_id=user.id, category="fact", content="User likes Python")

    memories = await repo.list_by_user(user.id, category="fact")
    assert len(memories) == 1
    assert "Python" in memories[0].content
```

- [ ] **Step 2: UserMemoryRepository 구현**

```python
# backend/src/alma/domain/memory/repository.py
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from alma.models.models import UserMemory


class UserMemoryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, user_id: uuid.UUID, category: str, content: str,
                     embedding: list[float] | None = None) -> UserMemory:
        mem = UserMemory(user_id=user_id, category=category, content=content, embedding=embedding)
        self.session.add(mem)
        await self.session.commit()
        await self.session.refresh(mem)
        return mem

    async def list_by_user(self, user_id: uuid.UUID, category: str | None = None,
                           limit: int = 50) -> list[UserMemory]:
        query = select(UserMemory).where(UserMemory.user_id == user_id)
        if category:
            query = query.where(UserMemory.category == category)
        query = query.order_by(UserMemory.updated_at.desc()).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def search_similar(self, user_id: uuid.UUID, embedding: list[float],
                             limit: int = 5) -> list[UserMemory]:
        query = (
            select(UserMemory)
            .where(UserMemory.user_id == user_id)
            .where(UserMemory.embedding.isnot(None))
            .order_by(UserMemory.embedding.cosine_distance(embedding))
            .limit(limit)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())
```

- [ ] **Step 3: 테스트 통과**

```bash
pytest tests/test_user_memory.py -v
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/alma/domain/memory/repository.py backend/tests/test_user_memory.py
git commit -m "feat: UserMemoryRepository (CRUD + 벡터 검색)"
```

---

### Task 8: E2E 통합 검증 + Push

- [ ] **Step 1: 전체 테스트 실행**

```bash
DATABASE_URL="..." TEST_DATABASE_URL="..." pytest tests/ -v --tb=short
```

Expected: 전체 통과 (20+ tests)

- [ ] **Step 2: Ruff lint/format**

```bash
ruff check src/ tests/ && ruff format --check src/ tests/
```

- [ ] **Step 3: 서버 시작 + 브라우저 E2E**

1. Backend: `uvicorn alma.main:app --port 8000`
2. Frontend: `npm run dev`
3. 로그인 → 대화 선택 → 이전 메시지 표시 확인
4. 새 메시지 전송 → 응답 확인
5. 새로고침 → 히스토리 유지 확인
6. 프로필 설정 (`/api/users/me/preferences`) curl 테스트

- [ ] **Step 4: Final commit + push**

```bash
git add -A
git commit -m "feat: Phase 2 Memory Enhancement 완료 — 히스토리/벡터검색/프로필학습"
git push
```

- [ ] **Step 5: PROCESS.md 업데이트**
