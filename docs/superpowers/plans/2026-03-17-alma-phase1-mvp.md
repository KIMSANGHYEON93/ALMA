# VIVARA Phase 1 MVP Implementation Plan (formerly ALMA)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대화하고, 기억하고, 대신 행동하는 개인 AI 비서 MVP를 구축한다.

**Architecture:** FastAPI 백엔드 + Next.js 프론트엔드 + PostgreSQL/pgvector 단일 DB. 서비스 간 직접 함수 호출, 이벤트 버스 없음. LLM은 Claude API 1개, 인터페이스 추상화만 준비.

**Tech Stack:** Python 3.14, uv (패키지 매니저), FastAPI 0.135+, SQLAlchemy 2.0+, Alembic, anthropic SDK 0.85+, openai SDK 2.28+, Next.js 14, React, Tailwind CSS, PostgreSQL 16, pgvector, Docker Compose, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-03-17-alma-phase1-mvp.md`

---

## File Structure

### Backend (`backend/`)

| Path | Responsibility |
|------|---------------|
| `src/alma/__init__.py` | Package init |
| `src/alma/main.py` | FastAPI app factory, lifespan, CORS, router mount |
| `src/alma/config.py` | Pydantic Settings (env vars) |
| `src/alma/database.py` | SQLAlchemy async engine + session factory |
| `src/alma/models/models.py` | SQLAlchemy ORM models (4 tables) |
| `src/alma/repositories/repositories.py` | DB access layer (CRUD operations) |
| `src/alma/llm/base.py` | LLMProvider Protocol + dataclasses |
| `src/alma/llm/claude.py` | Claude API implementation |
| `src/alma/services/memory.py` | MemoryService (store, search, history) |
| `src/alma/services/chat.py` | ChatService (process_message orchestration) |
| `src/alma/services/integration.py` | IntegrationService (MCP action execution) |
| `src/alma/auth/auth.py` | JWT creation, verification, password hashing |
| `src/alma/auth/dependencies.py` | FastAPI dependencies (get_current_user) |
| `src/alma/api/auth.py` | Auth router (login, register) |
| `src/alma/api/conversations.py` | Conversations router (list, create, search) |
| `src/alma/api/chat.py` | WebSocket chat endpoint |
| `tests/conftest.py` | Fixtures (test DB, test client, test user) |
| `tests/test_models.py` | Model creation tests |
| `tests/test_auth.py` | Auth service + endpoint tests |
| `tests/test_memory.py` | MemoryService tests |
| `tests/test_chat.py` | ChatService tests |
| `tests/test_integration.py` | IntegrationService tests |
| `tests/test_api_conversations.py` | Conversations API tests |
| `alembic/` | DB migration directory |
| `pyproject.toml` | Dependencies + tool config |
| `Dockerfile` | Backend container |

### Frontend (`frontend/`)

| Path | Responsibility |
|------|---------------|
| `src/app/layout.tsx` | Root layout (providers, fonts) |
| `src/app/page.tsx` | Main chat page |
| `src/app/login/page.tsx` | Login page |
| `src/components/ChatWindow.tsx` | Chat message display + input |
| `src/components/MessageBubble.tsx` | Single message display |
| `src/components/ConversationList.tsx` | Sidebar conversation list |
| `src/lib/api.ts` | REST API client (auth, conversations) |
| `src/lib/websocket.ts` | WebSocket client (chat) |
| `src/lib/auth.ts` | Token storage + refresh |
| `package.json` | Dependencies |
| `Dockerfile` | Frontend container |

### Root

| Path | Responsibility |
|------|---------------|
| `docker-compose.yml` | PG + backend + frontend |
| `.github/workflows/ci.yml` | CI pipeline |
| `.env.example` | Environment variable template |

---

## Chunk 1: Project Scaffolding + Database

### Task 1: Project Initialization

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/src/alma/__init__.py`
- Create: `backend/src/alma/config.py`
- Create: `.env.example`

- [ ] **Step 1: Create backend directory structure**

```bash
cd ~/alma
mkdir -p backend/src/alma/{api,services,llm,models,repositories,auth}
mkdir -p backend/tests
mkdir -p backend/alembic
touch backend/src/alma/__init__.py
touch backend/src/alma/api/__init__.py
touch backend/src/alma/services/__init__.py
touch backend/src/alma/llm/__init__.py
touch backend/src/alma/models/__init__.py
touch backend/src/alma/repositories/__init__.py
touch backend/src/alma/auth/__init__.py
touch backend/tests/__init__.py
```

- [ ] **Step 2: Write pyproject.toml**

```toml
# backend/pyproject.toml
[project]
name = "alma"
version = "0.1.0"
description = "ALMA - Adaptive Life Management Agent"
requires-python = ">=3.13"
dependencies = [
    "fastapi>=0.135.0",
    "uvicorn[standard]>=0.30.0",
    "sqlalchemy[asyncio]>=2.0.0",
    "asyncpg>=0.30.0",
    "alembic>=1.14.0",
    "pgvector>=0.3.0",
    "anthropic>=0.85.0",
    "openai>=2.28.0",
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "pydantic-settings>=2.0.0",
    "pydantic[email]>=2.0.0",
    "websockets>=13.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=1.3.0",
    "pytest-cov>=6.0.0",
    "httpx>=0.27.0",
    "ruff>=0.8.0",
    "mypy>=1.13.0",
]

[build-system]
requires = ["setuptools>=75.0"]
build-backend = "setuptools.build_meta"

[tool.ruff]
target-version = "py312"
line-length = 100

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.mypy]
python_version = "3.12"
strict = true
```

- [ ] **Step 3: Write config.py**

```python
# backend/src/alma/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://alma:alma@localhost:5432/alma"
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
```

- [ ] **Step 4: Write .env.example**

```bash
DATABASE_URL=postgresql+asyncpg://alma:alma@localhost:5432/alma
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
JWT_SECRET=change-me-in-production
```

- [ ] **Step 5: Create virtual environment with uv**

```bash
cd ~/alma/backend
uv venv .venv --python 3.14
source .venv/Scripts/activate   # Windows Git Bash
```

Verify:
```bash
which python    # should point to .venv/Scripts/python
python --version  # Python 3.14.0
```

- [ ] **Step 6: Install dependencies and verify**

```bash
cd ~/alma/backend
uv pip install -e ".[dev]"
python -c "from alma.config import settings; print(settings)"
```

Expected: Settings object prints without error

Note: Add `.venv/` to `.gitignore`:
```bash
echo ".venv/" >> ~/alma/.gitignore
```

- [ ] **Step 6: Commit**

```bash
git add backend/pyproject.toml backend/src/ .env.example
git commit -m "feat: initialize ALMA backend project structure"
```

---

### Task 2: Database Models + Migration

**Files:**
- Create: `backend/src/alma/database.py`
- Create: `backend/src/alma/models/models.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_models.py`

- [ ] **Step 1: Write failing test for User model**

```python
# backend/tests/test_models.py
import pytest
from sqlalchemy import select
from alma.models.models import User


@pytest.mark.asyncio
async def test_create_user(db_session):
    user = User(email="test@example.com", password_hash="hashed", display_name="Test")
    db_session.add(user)
    await db_session.commit()

    result = await db_session.execute(select(User).where(User.email == "test@example.com"))
    saved = result.scalar_one()
    assert saved.email == "test@example.com"
    assert saved.display_name == "Test"
    assert saved.id is not None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/alma/backend
pytest tests/test_models.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'alma.models.models'` or similar

- [ ] **Step 3: Write database.py**

```python
# backend/src/alma/database.py
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from alma.config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncSession:  # type: ignore[misc]
    async with async_session() as session:
        yield session
```

- [ ] **Step 4: Write models.py (4 tables)**

```python
# backend/src/alma/models/models.py
import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Index, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(nullable=False)
    display_name: Mapped[str | None] = mapped_column(nullable=True)
    preferences: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    conversations: Mapped[list["Conversation"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")

    __table_args__ = (Index("idx_conversations_user", "user_id", "updated_at"),)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(Vector(1536), nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")

    __table_args__ = (
        Index("idx_messages_conversation", "conversation_id", "created_at"),
        Index("idx_messages_embedding", "embedding", postgresql_using="hnsw", postgresql_ops={"embedding": "vector_cosine_ops"}),
    )


class ActionLog(Base):
    __tablename__ = "action_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    service: Mapped[str] = mapped_column(nullable=False)
    action: Mapped[str] = mapped_column(nullable=False)
    params: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    success: Mapped[bool] = mapped_column(default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (Index("idx_actions_user", "user_id", "created_at"),)
```

- [ ] **Step 5: Write test conftest.py with test DB fixtures**

```python
# backend/tests/conftest.py
from collections.abc import AsyncGenerator

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from alma.models.models import Base
from alma.database import get_session
from alma.main import app

import os
TEST_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://alma:alma@localhost:5433/alma_test")


@pytest.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        # Override FastAPI dependency to use test DB (must be async generator)
        async def override_get_session():
            yield session
        app.dependency_overrides[get_session] = override_get_session
        yield session
        await session.rollback()
        app.dependency_overrides.clear()
```

Note: `pytest-asyncio>=0.24` uses `asyncio_mode = "auto"` from pyproject.toml. Add to pyproject.toml:

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "session"
testpaths = ["tests"]
```

- [ ] **Step 6: Run test to verify it passes**

```bash
pytest tests/test_models.py -v
```

Expected: PASS

- [ ] **Step 7: Initialize Alembic**

```bash
cd ~/alma/backend
alembic init alembic
```

Replace the entire contents of `alembic/env.py` with:

```python
# backend/alembic/env.py
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from alma.config import settings
from alma.models.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline():
    url = settings.database_url
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations():
    connectable = create_async_engine(settings.database_url)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online():
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

Edit `alembic.ini` — set `sqlalchemy.url` to empty (loaded from env):
```ini
sqlalchemy.url =
```

- [ ] **Step 8: Create initial migration**

```bash
alembic revision --autogenerate -m "initial_schema"
alembic upgrade head
```

- [ ] **Step 9: Commit**

```bash
git add backend/src/alma/database.py backend/src/alma/models/ backend/tests/ backend/alembic/
git commit -m "feat: add database models and initial migration (4 tables)"
```

---

### Task 3: Docker Compose

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Write docker-compose.yml**

```yaml
# docker-compose.yml
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: alma
      POSTGRES_PASSWORD: alma
      POSTGRES_DB: alma
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U alma"]
      interval: 5s
      timeout: 5s
      retries: 5

  db-test:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: alma
      POSTGRES_PASSWORD: alma
      POSTGRES_DB: alma_test
    ports:
      - "5433:5432"

volumes:
  pgdata:
```

- [ ] **Step 2: Start DB and verify**

```bash
cd ~/alma
docker-compose up -d db db-test
docker-compose exec db psql -U alma -c "CREATE EXTENSION IF NOT EXISTS vector;"
docker-compose exec db-test psql -U alma -d alma_test -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

- [ ] **Step 3: Run all tests against test DB**

```bash
cd ~/alma/backend
pytest tests/ -v
```

Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add docker-compose with PostgreSQL + pgvector"
```

---

## Chunk 2: Auth + LLM Provider

### Task 4: JWT Authentication

**Files:**
- Create: `backend/src/alma/auth/auth.py`
- Create: `backend/src/alma/auth/dependencies.py`
- Create: `backend/src/alma/api/auth.py`
- Create: `backend/tests/test_auth.py`

- [ ] **Step 1: Write failing test for password hashing**

```python
# backend/tests/test_auth.py
from alma.auth.auth import hash_password, verify_password


def test_password_hash_and_verify():
    hashed = hash_password("mypassword")
    assert verify_password("mypassword", hashed) is True
    assert verify_password("wrongpassword", hashed) is False
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_auth.py::test_password_hash_and_verify -v
```

Expected: FAIL

- [ ] **Step 3: Implement auth.py**

```python
# backend/src/alma/auth/auth.py
from datetime import datetime, timedelta, timezone

from jose import jwt
from passlib.context import CryptContext
from alma.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    return jwt.encode({"sub": user_id, "exp": expire}, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days)
    return jwt.encode({"sub": user_id, "exp": expire, "type": "refresh"}, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_auth.py::test_password_hash_and_verify -v
```

Expected: PASS

- [ ] **Step 5: Write failing test for token creation**

```python
# append to backend/tests/test_auth.py
from alma.auth.auth import create_access_token, decode_token


def test_create_and_decode_token():
    token = create_access_token("user-123")
    payload = decode_token(token)
    assert payload["sub"] == "user-123"
```

- [ ] **Step 6: Run test to verify it passes**

```bash
pytest tests/test_auth.py -v
```

Expected: All PASS

- [ ] **Step 7: Write failing test for register endpoint**

```python
# append to backend/tests/test_auth.py
import pytest
from httpx import ASGITransport, AsyncClient
from alma.main import app


@pytest.mark.asyncio
async def test_register_user(db_session):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/auth/register", json={
            "email": "new@example.com",
            "password": "securepass123",
            "display_name": "New User",
        })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
```

- [ ] **Step 8: Implement dependencies.py, api/auth.py, main.py**

```python
# backend/src/alma/auth/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.auth import decode_token
from alma.database import get_session
from alma.models.models import User

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: AsyncSession = Depends(get_session),
) -> User:
    try:
        payload = decode_token(credentials.credentials)
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
```

```python
# backend/src/alma/api/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.auth import create_access_token, create_refresh_token, hash_password, verify_password
from alma.database import get_session
from alma.models.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, session: AsyncSession = Depends(get_session)):
    existing = await session.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(email=req.email, password_hash=hash_password(req.password), display_name=req.display_name)
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=TokenResponse)
async def refresh(req: RefreshRequest, session: AsyncSession = Depends(get_session)):
    try:
        payload = decode_token(req.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await session.execute(select(User).where(User.id == user_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=401, detail="User not found")

    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )
```

```python
# backend/src/alma/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from alma.api.auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="ALMA", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(auth_router)
```

- [ ] **Step 9: Run all auth tests**

```bash
pytest tests/test_auth.py -v
```

Expected: All PASS

- [ ] **Step 10: Commit**

```bash
git add backend/src/alma/auth/ backend/src/alma/api/auth.py backend/src/alma/main.py backend/tests/test_auth.py
git commit -m "feat: add JWT authentication (register, login)"
```

---

### Task 5: LLM Provider (Claude)

**Files:**
- Create: `backend/src/alma/llm/base.py`
- Create: `backend/src/alma/llm/claude.py`
- Create: `backend/tests/test_llm.py`

- [ ] **Step 1: Write failing test for LLM interface**

```python
# backend/tests/test_llm.py
import pytest
from alma.llm.base import ChatMessage, LLMRequest, LLMResponse


def test_llm_request_creation():
    msg = ChatMessage(role="user", content="Hello")
    req = LLMRequest(messages=[msg])
    assert len(req.messages) == 1
    assert req.max_tokens == 4096
    assert req.temperature == 0.7
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_llm.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement base.py**

```python
# backend/src/alma/llm/base.py
from dataclasses import dataclass, field
from typing import Protocol


@dataclass(frozen=True)
class ChatMessage:
    role: str
    content: str


@dataclass(frozen=True)
class LLMRequest:
    messages: list[ChatMessage]
    system_prompt: str | None = None
    max_tokens: int = 4096
    temperature: float = 0.7


@dataclass(frozen=True)
class LLMResponse:
    content: str
    model: str
    input_tokens: int
    output_tokens: int


class LLMProvider(Protocol):
    async def complete(self, request: LLMRequest) -> LLMResponse: ...
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_llm.py -v
```

Expected: PASS

- [ ] **Step 5: Implement claude.py**

```python
# backend/src/alma/llm/claude.py
import anthropic
from alma.config import settings
from alma.llm.base import ChatMessage, LLMProvider, LLMRequest, LLMResponse


class ClaudeProvider:
    def __init__(self, model: str = "claude-sonnet-4-6-20250514"):
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = model

    async def complete(self, request: LLMRequest) -> LLMResponse:
        messages = [{"role": m.role, "content": m.content} for m in request.messages]

        kwargs: dict = {
            "model": self.model,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "messages": messages,
        }
        if request.system_prompt:
            kwargs["system"] = request.system_prompt

        response = await self.client.messages.create(**kwargs)

        return LLMResponse(
            content=response.content[0].text,
            model=response.model,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )
```

- [ ] **Step 6: Write mock test for ClaudeProvider**

```python
# append to backend/tests/test_llm.py
from unittest.mock import AsyncMock, MagicMock, patch
from alma.llm.claude import ClaudeProvider
from alma.llm.base import LLMRequest, ChatMessage


@pytest.mark.asyncio
async def test_claude_provider_complete():
    provider = ClaudeProvider()

    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="Hello from Claude")]
    mock_response.model = "claude-sonnet-4-6-20250514"
    mock_response.usage.input_tokens = 10
    mock_response.usage.output_tokens = 5

    with patch.object(provider.client.messages, "create", new_callable=AsyncMock, return_value=mock_response):
        req = LLMRequest(messages=[ChatMessage(role="user", content="Hi")])
        resp = await provider.complete(req)

    assert resp.content == "Hello from Claude"
    assert resp.input_tokens == 10
```

- [ ] **Step 7: Run all LLM tests**

```bash
pytest tests/test_llm.py -v
```

Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/alma/llm/ backend/tests/test_llm.py
git commit -m "feat: add LLM provider interface + Claude implementation"
```

---

## Chunk 3: Memory Service + Chat Service

### Task 6: Repositories

**Files:**
- Create: `backend/src/alma/repositories/repositories.py`

- [ ] **Step 1: Write failing test for UserRepository**

```python
# backend/tests/test_repositories.py
import pytest
from alma.repositories.repositories import UserRepository
from alma.models.models import User


@pytest.mark.asyncio
async def test_create_and_find_user(db_session):
    repo = UserRepository(db_session)
    user = await repo.create(email="repo@test.com", password_hash="hashed", display_name="Repo")
    found = await repo.find_by_id(user.id)
    assert found is not None
    assert found.email == "repo@test.com"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_repositories.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement repositories.py**

```python
# backend/src/alma/repositories/repositories.py
import uuid
from datetime import datetime

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from alma.models.models import User, Conversation, Message, ActionLog


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, email: str, password_hash: str, display_name: str | None = None) -> User:
        user = User(email=email, password_hash=password_hash, display_name=display_name)
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def find_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def find_by_email(self, email: str) -> User | None:
        result = await self.session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()


class ConversationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, user_id: uuid.UUID, title: str | None = None) -> Conversation:
        conv = Conversation(user_id=user_id, title=title)
        self.session.add(conv)
        await self.session.commit()
        await self.session.refresh(conv)
        return conv

    async def list_by_user(self, user_id: uuid.UUID, limit: int = 20) -> list[Conversation]:
        result = await self.session.execute(
            select(Conversation).where(Conversation.user_id == user_id)
            .order_by(desc(Conversation.updated_at)).limit(limit)
        )
        return list(result.scalars().all())


class MessageRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, conversation_id: uuid.UUID, role: str, content: str,
                     embedding: list[float] | None = None) -> Message:
        msg = Message(conversation_id=conversation_id, role=role, content=content, embedding=embedding)
        self.session.add(msg)
        await self.session.commit()
        await self.session.refresh(msg)
        return msg

    async def get_history(self, conversation_id: uuid.UUID, limit: int = 20) -> list[Message]:
        result = await self.session.execute(
            select(Message).where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at).limit(limit)
        )
        return list(result.scalars().all())

    async def search_similar(self, user_id: uuid.UUID, embedding: list[float], limit: int = 5) -> list[Message]:
        result = await self.session.execute(
            select(Message)
            .join(Conversation)
            .where(Conversation.user_id == user_id)
            .where(Message.embedding.isnot(None))
            .order_by(Message.embedding.cosine_distance(embedding))
            .limit(limit)
        )
        return list(result.scalars().all())


class ActionLogRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, user_id: uuid.UUID, service: str, action: str,
                     params: dict, result: dict | None = None, success: bool = True) -> ActionLog:
        log = ActionLog(user_id=user_id, service=service, action=action,
                        params=params, result=result, success=success)
        self.session.add(log)
        await self.session.commit()
        return log
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_repositories.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/alma/repositories/ backend/tests/test_repositories.py
git commit -m "feat: add repository layer (User, Conversation, Message, ActionLog)"
```

---

### Task 7: Memory Service

**Files:**
- Create: `backend/src/alma/services/memory.py`
- Create: `backend/tests/test_memory.py`

- [ ] **Step 1: Write failing test for store_message**

```python
# backend/tests/test_memory.py
import pytest
from unittest.mock import AsyncMock, patch
from alma.services.memory import MemoryService
from alma.models.models import User, Conversation


@pytest.mark.asyncio
async def test_store_message(db_session):
    # Setup: create user + conversation
    user = User(email="mem@test.com", password_hash="hashed", display_name="Mem")
    db_session.add(user)
    await db_session.flush()
    conv = Conversation(user_id=user.id, title="Test")
    db_session.add(conv)
    await db_session.flush()

    service = MemoryService(db_session)

    with patch.object(service, "_get_embedding", new_callable=AsyncMock, return_value=[0.1] * 1536):
        await service.store_message(conversation_id=str(conv.id), role="user", content="Hello ALMA")

    # Verify message was stored
    from alma.repositories.repositories import MessageRepository
    repo = MessageRepository(db_session)
    messages = await repo.get_history(conv.id)
    assert len(messages) == 1
    assert messages[0].content == "Hello ALMA"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_memory.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement memory.py**

```python
# backend/src/alma/services/memory.py
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from alma.llm.base import ChatMessage
from alma.repositories.repositories import MessageRepository, ConversationRepository


class MemoryService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.message_repo = MessageRepository(session)
        self.conversation_repo = ConversationRepository(session)

    async def store_message(self, conversation_id: str, role: str, content: str) -> None:
        embedding = await self._get_embedding(content)
        await self.message_repo.create(
            conversation_id=uuid.UUID(conversation_id),
            role=role,
            content=content,
            embedding=embedding,
        )

    async def search_similar(self, user_id: str, query: str, limit: int = 5) -> list[ChatMessage]:
        embedding = await self._get_embedding(query)
        messages = await self.message_repo.search_similar(
            user_id=uuid.UUID(user_id), embedding=embedding, limit=limit
        )
        return [ChatMessage(role=m.role, content=m.content) for m in messages]

    async def get_conversation_history(self, conversation_id: str, limit: int = 20) -> list[ChatMessage]:
        messages = await self.message_repo.get_history(
            conversation_id=uuid.UUID(conversation_id), limit=limit
        )
        return [ChatMessage(role=m.role, content=m.content) for m in messages]

    async def _get_embedding(self, text: str) -> list[float]:
        import openai
        from alma.config import settings
        client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=text,
        )
        return response.data[0].embedding
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_memory.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/alma/services/memory.py backend/tests/test_memory.py
git commit -m "feat: add MemoryService (store, search, history)"
```

---

### Task 8: Chat Service

**Files:**
- Create: `backend/src/alma/services/chat.py`
- Create: `backend/tests/test_chat.py`

- [ ] **Step 1: Write failing test for process_message**

```python
# backend/tests/test_chat.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from alma.services.chat import ChatService
from alma.llm.base import LLMResponse, ChatMessage


@pytest.mark.asyncio
async def test_process_message(db_session):
    # Setup: create user + conversation
    from alma.models.models import User, Conversation
    user = User(email="chat@test.com", password_hash="hashed")
    db_session.add(user)
    await db_session.flush()
    conv = Conversation(user_id=user.id, title="Test")
    db_session.add(conv)
    await db_session.flush()

    mock_llm = AsyncMock()
    mock_llm.complete.return_value = LLMResponse(
        content="I'll help you with that!", model="test", input_tokens=10, output_tokens=5
    )

    service = ChatService(session=db_session, llm=mock_llm)

    with patch.object(service.memory, "_get_embedding", new_callable=AsyncMock, return_value=[0.1] * 1536):
        with patch.object(service.memory, "search_similar", new_callable=AsyncMock, return_value=[]):
            with patch.object(service.integration, "detect_action_intent", new_callable=AsyncMock, return_value=None):
                response = await service.process_message(
                    user_id=str(user.id), conversation_id=str(conv.id), content="Help me"
                )

    assert "I'll help you with that!" in response
    mock_llm.complete.assert_called_once()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_chat.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement chat.py**

```python
# backend/src/alma/services/chat.py
from sqlalchemy.ext.asyncio import AsyncSession

from alma.llm.base import ChatMessage, LLMProvider, LLMRequest
from alma.services.memory import MemoryService

SYSTEM_PROMPT = """You are ALMA (Adaptive Life Management Agent), a personal AI assistant.
Your mission: help users grow toward the life they desire.
You remember past conversations and use that context to provide personalized help.
You can take actions on behalf of the user (calendar, notes) when asked.
Always respond in the user's language. Be concise and helpful."""


class ChatService:
    def __init__(self, session: AsyncSession, llm: LLMProvider):
        self.session = session
        self.llm = llm
        self.memory = MemoryService(session)
        from alma.services.integration import IntegrationService
        self.integration = IntegrationService(session, llm)

    async def process_message(self, user_id: str, conversation_id: str, content: str) -> str:
        # 1. Store user message
        await self.memory.store_message(conversation_id, "user", content)

        # 2. Search similar past conversations
        similar = await self.memory.search_similar(user_id, content, limit=3)

        # 3. Get current conversation history
        history = await self.memory.get_conversation_history(conversation_id, limit=10)

        # 4. Build LLM request
        messages: list[ChatMessage] = []

        # Add relevant past context
        if similar:
            context = "\n".join([f"[Past {m.role}]: {m.content}" for m in similar])
            messages.append(ChatMessage(role="user", content=f"[Relevant past context]\n{context}"))
            messages.append(ChatMessage(role="assistant", content="I'll keep this context in mind."))

        # Add current conversation
        for msg in history:
            messages.append(msg)

        # 5. Call LLM
        request = LLMRequest(messages=messages, system_prompt=SYSTEM_PROMPT)
        response = await self.llm.complete(request)

        # 6. Detect action intent from response
        intent = await self.integration.detect_action_intent(response.content)
        action_note = ""
        if intent and intent.needs_confirmation:
            action_note = f"\n\n---\n[Action: {intent.service}.{intent.action}({intent.params}). 실행할까요? (예/아니오)]"

        # 7. Store assistant response
        full_response = response.content + action_note
        await self.memory.store_message(conversation_id, "assistant", full_response)

        return full_response
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_chat.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/alma/services/chat.py backend/tests/test_chat.py
git commit -m "feat: add ChatService (message processing with memory context)"
```

---

## Chunk 4: API Endpoints + WebSocket

### Task 9: Conversations API

**Files:**
- Create: `backend/src/alma/api/conversations.py`
- Create: `backend/tests/test_api_conversations.py`

- [ ] **Step 1: Write failing test for list conversations**

```python
# backend/tests/test_api_conversations.py
import pytest
from httpx import ASGITransport, AsyncClient
from alma.main import app


@pytest.mark.asyncio
async def test_list_conversations_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/conversations")
    assert resp.status_code == 403
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_api_conversations.py -v
```

Expected: FAIL (404 — route doesn't exist yet)

- [ ] **Step 3: Implement conversations.py**

```python
# backend/src/alma/api/conversations.py
import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.dependencies import get_current_user
from alma.database import get_session
from alma.models.models import User
from alma.repositories.repositories import ConversationRepository

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


class ConversationResponse(BaseModel):
    id: str
    title: str | None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class CreateConversationRequest(BaseModel):
    title: str | None = None


@router.get("/", response_model=list[ConversationResponse])
async def list_conversations(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = ConversationRepository(session)
    convs = await repo.list_by_user(user.id)
    return [ConversationResponse(
        id=str(c.id), title=c.title,
        created_at=c.created_at.isoformat(), updated_at=c.updated_at.isoformat()
    ) for c in convs]


@router.post("/", response_model=ConversationResponse, status_code=201)
async def create_conversation(
    req: CreateConversationRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = ConversationRepository(session)
    conv = await repo.create(user.id, req.title)
    return ConversationResponse(
        id=str(conv.id), title=conv.title,
        created_at=conv.created_at.isoformat(), updated_at=conv.updated_at.isoformat()
    )
```

- [ ] **Step 4: Register router in main.py**

```python
# Add to backend/src/alma/main.py
from alma.api.conversations import router as conversations_router
app.include_router(conversations_router)
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pytest tests/test_api_conversations.py -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/alma/api/conversations.py backend/tests/test_api_conversations.py backend/src/alma/main.py
git commit -m "feat: add conversations API (list, create)"
```

---

### Task 10: WebSocket Chat Endpoint

**Files:**
- Create: `backend/src/alma/api/chat.py`
- Create: `backend/tests/test_websocket.py`

- [ ] **Step 1: Write failing test for WebSocket connection**

```python
# backend/tests/test_websocket.py
import pytest
from starlette.testclient import TestClient
from alma.main import app


def test_websocket_rejects_without_token():
    client = TestClient(app)
    with pytest.raises(Exception):
        with client.websocket_connect("/api/chat/ws/fake-conv-id"):
            pass
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_websocket.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement chat.py WebSocket endpoint**

```python
# backend/src/alma/api/chat.py
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.auth import decode_token
from alma.database import get_session, async_session
from alma.llm.claude import ClaudeProvider
from alma.services.chat import ChatService

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.websocket("/ws/{conversation_id}")
async def websocket_chat(websocket: WebSocket, conversation_id: str):
    # Authenticate via query param token
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        payload = decode_token(token)
        user_id = payload["sub"]
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await websocket.accept()

    async with async_session() as session:
        llm = ClaudeProvider()
        chat_service = ChatService(session=session, llm=llm)

        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                content = message.get("content", "")

                response = await chat_service.process_message(
                    user_id=user_id,
                    conversation_id=conversation_id,
                    content=content,
                )

                await websocket.send_text(json.dumps({
                    "type": "message",
                    "content": response,
                }))
        except WebSocketDisconnect:
            pass
```

- [ ] **Step 4: Register router in main.py**

```python
# Add to backend/src/alma/main.py
from alma.api.chat import router as chat_router
app.include_router(chat_router)
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pytest tests/test_websocket.py -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/alma/api/chat.py backend/tests/test_websocket.py backend/src/alma/main.py
git commit -m "feat: add WebSocket chat endpoint with JWT auth"
```

---

## Chunk 5: Integration Service + Frontend + CI

### Task 11: Integration Service (Google Calendar)

**Files:**
- Create: `backend/src/alma/services/integration.py`
- Create: `backend/tests/test_integration.py`

- [ ] **Step 1: Write failing test for detect_action_intent**

```python
# backend/tests/test_integration.py
import pytest
from unittest.mock import AsyncMock
from alma.services.integration import IntegrationService, ActionIntent


@pytest.mark.asyncio
async def test_detect_action_intent(db_session):
    mock_llm = AsyncMock()
    mock_llm.complete.return_value = type("R", (), {
        "content": '{"service":"calendar","action":"create_event","params":{"title":"Team meeting","date":"2026-03-18","time":"14:00"},"needs_confirmation":true}'
    })()

    service = IntegrationService(db_session, mock_llm)
    intent = await service.detect_action_intent("Please schedule a team meeting tomorrow at 2pm")

    assert intent is not None
    assert intent.service == "calendar"
    assert intent.needs_confirmation is True
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_integration.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement integration.py**

```python
# backend/src/alma/services/integration.py
import json
import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from alma.llm.base import ChatMessage, LLMProvider, LLMRequest
from alma.repositories.repositories import ActionLogRepository


@dataclass
class ActionIntent:
    service: str
    action: str
    params: dict
    needs_confirmation: bool = True


class IntegrationService:
    def __init__(self, session: AsyncSession, llm: LLMProvider):
        self.session = session
        self.llm = llm
        self.action_log_repo = ActionLogRepository(session)

    async def detect_action_intent(self, user_message: str) -> ActionIntent | None:
        prompt = """Analyze if this message requires an external action (calendar, notes).
If yes, respond with JSON: {"service":"calendar|notion","action":"...","params":{...},"needs_confirmation":true}
If no action needed, respond with: null
Message: """ + user_message

        request = LLMRequest(
            messages=[ChatMessage(role="user", content=prompt)],
            max_tokens=500,
            temperature=0.0,
        )
        response = await self.llm.complete(request)

        try:
            data = json.loads(response.content)
            if data is None:
                return None
            return ActionIntent(**data)
        except (json.JSONDecodeError, TypeError):
            return None

    async def execute_action(self, user_id: str, intent: ActionIntent) -> dict:
        result: dict = {}
        success = True

        try:
            if intent.service == "calendar":
                result = await self._execute_calendar_action(intent)
            elif intent.service == "notion":
                result = await self._execute_notion_action(intent)
            else:
                result = {"error": f"Unknown service: {intent.service}"}
                success = False
        except Exception as e:
            result = {"error": str(e)}
            success = False

        await self.action_log_repo.create(
            user_id=uuid.UUID(user_id),
            service=intent.service,
            action=intent.action,
            params=intent.params,
            result=result,
            success=success,
        )

        return result

    async def _execute_calendar_action(self, intent: ActionIntent) -> dict:
        """Google Calendar MCP 연동 — 실제 MCP 도구 호출"""
        # MCP 도구가 Claude Code 환경에서 제공됨
        # FastAPI 서버에서는 Google Calendar API 직접 호출
        # Phase 1: google-api-python-client 또는 MCP proxy 사용
        #
        # 여기서는 Action intent를 반환하여 프론트엔드에서 MCP 호출 가능하게 함
        return {
            "status": "action_ready",
            "service": "calendar",
            "action": intent.action,
            "params": intent.params,
            "message": f"Calendar action '{intent.action}' prepared for execution",
        }

    async def _execute_notion_action(self, intent: ActionIntent) -> dict:
        """Notion MCP 연동"""
        return {
            "status": "action_ready",
            "service": "notion",
            "action": intent.action,
            "params": intent.params,
            "message": f"Notion action '{intent.action}' prepared for execution",
        }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_integration.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/alma/services/integration.py backend/tests/test_integration.py
git commit -m "feat: add IntegrationService (action intent detection + logging)"
```

---

### Task 12: Frontend Scaffolding

**Files:**
- Create: `frontend/` (Next.js project)

- [ ] **Step 1: Create Next.js project**

```bash
cd ~/alma
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --no-import-alias
```

- [ ] **Step 2: Install additional dependencies**

```bash
cd ~/alma/frontend
npm install
```

- [ ] **Step 3: Create auth token helper**

```typescript
// frontend/src/lib/auth.ts
const TOKEN_KEY = "alma_access_token";
const REFRESH_KEY = "alma_refresh_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}
```

- [ ] **Step 4: Create API client**

```typescript
// frontend/src/lib/api.ts
import { getToken, getRefreshToken, setTokens, clearTokens } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res = await fetch(`${API_BASE}${url}`, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setTokens(data.access_token, data.refresh_token);
        headers["Authorization"] = `Bearer ${data.access_token}`;
        res = await fetch(`${API_BASE}${url}`, { ...options, headers });
      } else {
        clearTokens();
        window.location.href = "/login";
      }
    }
  }

  return res;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function register(email: string, password: string, displayName: string) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
  if (!res.ok) throw new Error("Register failed");
  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function getConversations() {
  const res = await fetchWithAuth("/api/conversations");
  if (!res.ok) throw new Error("Failed to fetch conversations");
  return res.json();
}

export async function createConversation(title?: string) {
  const res = await fetchWithAuth("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to create conversation");
  return res.json();
}
```

- [ ] **Step 5: Create WebSocket client**

```typescript
// frontend/src/lib/websocket.ts
import { getToken } from "./auth";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export function createChatSocket(
  conversationId: string,
  onMessage: (content: string) => void,
  onError?: (error: Event) => void,
): WebSocket {
  const token = getToken();
  const ws = new WebSocket(`${WS_BASE}/api/chat/ws/${conversationId}?token=${token}`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "message") {
      onMessage(data.content);
    }
  };

  ws.onerror = (event) => {
    if (onError) onError(event);
  };

  return ws;
}

export function sendMessage(ws: WebSocket, content: string): void {
  ws.send(JSON.stringify({ content }));
}
```

- [ ] **Step 6: Create ChatWindow component**

```tsx
// frontend/src/components/ChatWindow.tsx
"use client";
import { useState, useRef, useEffect } from "react";
import { createChatSocket, sendMessage } from "@/lib/websocket";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatWindow({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId) return;

    const ws = createChatSocket(
      conversationId,
      (content) => {
        setMessages((prev) => [...prev, { role: "assistant", content }]);
      },
    );
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    wsRef.current = ws;

    return () => ws.close();
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !wsRef.current) return;
    setMessages((prev) => [...prev, { role: "user", content: input }]);
    sendMessage(wsRef.current, input);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[70%] rounded-lg p-3 ${
              msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-900"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="border-t p-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="메시지를 입력하세요..."
          className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSend}
          disabled={!isConnected}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          전송
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create ConversationList component**

```tsx
// frontend/src/components/ConversationList.tsx
"use client";
import { useState, useEffect } from "react";
import { getConversations, createConversation } from "@/lib/api";

interface Conversation {
  id: string;
  title: string | null;
  updated_at: string;
}

export default function ConversationList({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    getConversations().then(setConversations).catch(console.error);
  }, []);

  const handleNew = async () => {
    const conv = await createConversation("New Chat");
    setConversations((prev) => [conv, ...prev]);
    onSelect(conv.id);
  };

  return (
    <div className="w-64 border-r h-full flex flex-col bg-gray-50">
      <button
        onClick={handleNew}
        className="m-3 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        + 새 대화
      </button>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`p-3 cursor-pointer hover:bg-gray-200 ${
              selected === conv.id ? "bg-blue-100" : ""
            }`}
          >
            <div className="font-medium truncate">{conv.title || "Untitled"}</div>
            <div className="text-xs text-gray-500">{new Date(conv.updated_at).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create login page**

```tsx
// frontend/src/app/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, register } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (isRegister) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
      router.push("/");
    } catch {
      setError(isRegister ? "Registration failed" : "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">ALMA</h1>
        {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}
        {isRegister && (
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="이름" className="w-full mb-3 p-2 border rounded" />
        )}
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
          placeholder="이메일" className="w-full mb-3 p-2 border rounded" required />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
          placeholder="비밀번호" className="w-full mb-4 p-2 border rounded" required />
        <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
          {isRegister ? "회원가입" : "로그인"}
        </button>
        <p className="mt-4 text-center text-sm text-gray-600 cursor-pointer"
          onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? "이미 계정이 있으신가요? 로그인" : "계정이 없으신가요? 회원가입"}
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 9: Create main chat page**

```tsx
// frontend/src/app/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import ChatWindow from "@/components/ChatWindow";
import ConversationList from "@/components/ConversationList";

export default function Home() {
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.push("/login");
  }, [router]);

  return (
    <div className="flex h-screen">
      <ConversationList selected={selectedConv} onSelect={setSelectedConv} />
      <div className="flex-1">
        {selectedConv ? (
          <ChatWindow conversationId={selectedConv} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            대화를 선택하거나 새 대화를 시작하세요
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Verify frontend builds**

```bash
cd ~/alma/frontend
npm run build
```

Expected: Build succeeds

- [ ] **Step 10: Commit**

```bash
git add frontend/
git commit -m "feat: add Next.js frontend with chat UI"
```

---

### Task 13: Docker + CI

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Modify: `docker-compose.yml`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write backend Dockerfile**

```dockerfile
# backend/Dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml .
COPY src/ src/
RUN pip install .
COPY alembic/ alembic/
COPY alembic.ini .
CMD ["uvicorn", "alma.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Write frontend Dockerfile**

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
CMD ["npm", "start"]
```

- [ ] **Step 3: Update docker-compose.yml with all services**

Add backend and frontend services to existing docker-compose.yml.

- [ ] **Step 4: Write CI workflow**

```yaml
# .github/workflows/ci.yml
name: ALMA CI
on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: alma
          POSTGRES_PASSWORD: alma
          POSTGRES_DB: alma_test
        ports: ["5432:5432"]
        options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    env:
      DATABASE_URL: postgresql+asyncpg://alma:alma@localhost:5432/alma_test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: cd backend && pip install -e ".[dev]"
      - run: cd backend && ruff check src/
      - run: cd backend && mypy src/
      - run: cd backend && pytest tests/ --cov=alma --cov-report=term --cov-fail-under=80

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint
      - run: cd frontend && npm run build
```

- [ ] **Step 5: Test full stack with docker-compose**

```bash
cd ~/alma
docker-compose up --build -d
curl http://localhost:8000/docs  # FastAPI swagger
curl http://localhost:3000       # Next.js frontend
```

- [ ] **Step 6: Commit**

```bash
git add backend/Dockerfile frontend/Dockerfile docker-compose.yml .github/
git commit -m "feat: add Docker + CI pipeline (ruff, mypy, pytest, next build)"
```

---

### Task 14: End-to-End Verification

- [ ] **Step 1: Run full test suite**

```bash
cd ~/alma/backend
pytest tests/ -v --cov=alma --cov-report=term
```

Expected: All PASS, coverage >80%

- [ ] **Step 2: Verify docker-compose stack**

```bash
docker-compose up -d
# Register user
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@alma.dev","password":"test123","display_name":"Test"}'
```

Expected: 201 with tokens

- [ ] **Step 3: Run ruff + mypy**

```bash
cd ~/alma/backend
ruff check src/
mypy src/
```

Expected: No errors

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: ALMA Phase 1 MVP complete - chat, memory, integration"
```
