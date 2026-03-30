# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VIVARA (formerly ALMA — Adaptive Life Management Agent) — 자기학습 AI 개인 비서
- Mission: "인간이 원하는 삶의 성장을 목표로 하는 미래를 만들어가는 AI 비서"
- Architecture: DDD (Domain-Driven Design) + SDD (Spec-Driven Design)
- Stack: FastAPI + Next.js 14 + Supabase PostgreSQL 17/pgvector + Claude API + Gemini/OpenAI Embeddings

## Commands

### Backend (from `backend/`)
```bash
source .venv/Scripts/activate          # Windows venv

# Dev server
uvicorn alma.main:app --reload --port 8000

# Test (requires DATABASE_URL)
DATABASE_URL="postgresql+asyncpg://..." TEST_DATABASE_URL="postgresql+asyncpg://..." pytest -v
pytest tests/test_auth.py -v           # Single file
pytest tests/test_auth.py::test_password_hash_and_verify -v  # Single test

# Lint & Format
ruff check src/ tests/
ruff format src/ tests/

# Migration
DATABASE_URL="postgresql+asyncpg://..." alembic revision --autogenerate -m "description"
DATABASE_URL="postgresql+asyncpg://..." alembic upgrade head
```

### Frontend (from `frontend/`)
```bash
npm run dev       # Dev server (port 3000, proxies /api/* → localhost:8000)
npm run build     # Production build
npm run lint      # ESLint
```

## Architecture

### Backend: DDD Bounded Contexts
```
api/                    → Presentation Layer (FastAPI routers)
  auth.py                 POST /api/auth/{register,login,refresh}
  conversations.py        GET/POST /api/conversations
  messages.py             GET /api/conversations/{id}/messages (cursor pagination)
  chat.py                 WebSocket /api/chat/ws/{id}?token=
  profile.py              GET/PUT /api/users/me/preferences
  goals.py                GET/POST/PUT/DELETE /api/goals, milestones, summary
  integrations.py         GET/POST/DELETE /api/integrations, Google OAuth + Calendar

domain/                 → Business Logic (DDD)
  identity/               Bounded Context: 인증/사용자
    service.py              JWT 생성/검증, bcrypt 해싱
    repository.py           UserRepository (CRUD)
    profile.py              UserProfileService (명시적+암묵적 선호 학습)
  chat/                   Bounded Context: 대화
    service.py              ChatService (memory → LLM → integration → response)
    repository.py           ConversationRepo, MessageRepo (cursor pagination)
  memory/                 Bounded Context: 기억
    service.py              MemoryService (저장 + 임베딩 + 벡터 검색)
    embedding.py            EmbeddingProvider Protocol (Gemini > OpenAI > None)
    repository.py           UserMemoryRepository (CRUD + vector search)
    models.py               SearchQuery, SearchResult 값 객체
  growth/                 Bounded Context: 성장 관리
    service.py              GoalService (CRUD + progress + 대화 연동)
    repository.py           GoalRepo, MilestoneRepo, LinkRepo
    models.py               GoalStatus, GoalCategory Enum
  integration/            Bounded Context: 외부 연동
    service.py              IntegrationService (인텐트 감지 + Calendar 실제 연동)
    repository.py           ActionLogRepo + IntegrationRepo
    oauth.py                GoogleOAuthService (OAuth2 + CSRF state)
    calendar.py             GoogleCalendarProvider (asyncio.to_thread)
    crypto.py               Fernet 토큰 암호화/복호화

infrastructure/         → Technical Implementations
  llm/
    base.py                 LLMProvider Protocol, ChatMessage, LLMRequest/Response
    claude.py               ClaudeProvider (claude-3-haiku-20240307)

models/models.py        → Shared Kernel (User, Conversation, Message, ActionLog, UserMemory, Goal, Milestone, GoalConversationLink, Integration)
auth/dependencies.py    → get_current_user (JWT verification FastAPI dependency)
config.py               → Settings (pydantic-settings)
database.py             → async engine + session (pgbouncer statement_cache_size=0)
```

### Chat Processing Flow
```
WebSocket → ChatService.process_message()
  1. store user message + embedding (768d vector)
  2. vector search similar past conversations
  3. retrieve user memories (just-in-time context)
  4. get current conversation history
  5. build context → call Claude API
  6. detect action intent (calendar/notion)
  7. update user profile (implicit learning)
  8. store assistant response
  9. send via WebSocket
```

### Frontend: Next.js 14 App Router
```
middleware.ts           → Server-side auth guard (cookie-based)
                          Protects: /chat, /settings → redirect to /login
                          Authenticated: /, /login → redirect to /chat

app/
  page.tsx                / — 3D Landing page (Spline iframe + hero + features)
  login/page.tsx          /login — 이메일/비밀번호 인증
  chat/page.tsx           /chat — ConversationList + ChatWindow

components/
  ChatWindow.tsx          채팅 UI (3개 커스텀 훅 사용)
  ConversationList.tsx    대화 목록 사이드바
  MessageBubble.tsx       메시지 버블 (React.memo + a11y)
  common/Spinner.tsx      공용 로딩 스피너

hooks/
  useMessages.ts          메시지 히스토리 + 상태 관리
  useChatWebSocket.ts     WebSocket 연결/재연결
  useInfiniteScroll.ts    IntersectionObserver 기반

contexts/AuthContext.tsx  AuthProvider + useAuth() (token, isLoading, logout)
lib/api.ts                apiClient (401 인터셉터 + skipAuthRedirect)
lib/auth.ts               토큰 관리 (localStorage + cookie 동시 저장)
lib/websocket.ts          WebSocket 유틸리티
```

## Key Design Decisions

- **Supabase cloud DB** (not local Docker): connect_args requires `statement_cache_size=0` for pgbouncer compatibility
- **bcrypt direct** (not passlib): passlib is unmaintained, breaks with bcrypt 4.x
- **redirect_slashes=False**: FastAPI 308 redirect strips Authorization headers
- **Embeddings**: Gemini (`google-genai` 1.68+) → OpenAI → None fallback chain, 768 dimensions
- **SAVEPOINT test isolation**: conftest.py uses nested transactions for repeatable tests against shared Supabase DB
- **asyncio_default_fixture_loop_scope = "function"**: session scope causes event loop mismatch with asyncpg
- **Cookie + localStorage dual token**: middleware.ts (server-side) reads cookie, client reads localStorage
- **Spline iframe embed**: `@splinetool/react-spline` NPM package incompatible with Next.js 14 webpack exports

## Alembic Notes
- `env.py` uses `create_async_engine` directly (not `engine_from_config`) for pgbouncer connect_args
- `DATABASE_URL` must be set as env var (pydantic-settings .env is NOT auto-loaded by Alembic)
- Autogenerated migrations need manual `import pgvector.sqlalchemy.vector`

## Removed Legacy Directories
`repositories/`, `services/`, `llm/` — all replaced by `domain/*/` and `infrastructure/llm/`

## Rules
- All responses in Korean (code/commits in English)
- DDD: bounded contexts, entities, value objects, aggregates
- SDD: Spec first → implement → verify
- First Principles review before every plan/design phase
- Context7 MCP for latest library docs before development
