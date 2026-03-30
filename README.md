# VIVARA — Adaptive Life Management Agent

> Self-learning AI personal assistant that grows with you.

VIVARA (formerly ALMA)는 사용자의 목표, 습관, 지식을 관리하고 성장을 돕는 AI 비서입니다. 대화를 기억하고, 패턴을 학습하며, 반복 작업을 자동화합니다.

## Features

| Feature | Description |
|---------|-------------|
| **AI Chat** | Claude/GPT/Gemini 멀티 LLM + 자동 폴백 |
| **Goals** | 목표 설정, 마일스톤 추적, 진행률 관리 |
| **Habits** | 습관 CRUD, 유연한 주기, streak 계산, 체크인 |
| **Analytics** | 히트맵, 트렌드, 완료율, 상관관계, AI 코칭 |
| **Knowledge** | 텍스트/URL 문서 수집, 벡터 검색, RAG |
| **Automation** | 이벤트 기반 패턴 감지, 자동화 규칙 실행 |
| **Retrospective** | 주간 회고, LLM 인사이트, 성장 대시보드 |
| **Calendar** | Google Calendar 연동, RRULE 반복 이벤트 |
| **Multi-Channel** | Web, CLI, Telegram |

## Architecture

```
┌────────────────────────────────────────────────────┐
│                    Frontend                         │
│         Next.js 14 · React 18 · Tailwind CSS        │
│    Chart.js · react-markdown · WebSocket client      │
└──────────────────────┬─────────────────────────────┘
                       │ REST / WebSocket
┌──────────────────────┴─────────────────────────────┐
│                     Backend                         │
│              FastAPI · Python 3.14                   │
│                                                     │
│  ┌─────────┐ ┌──────────┐ ┌────────────┐           │
│  │   API   │ │ Gateway  │ │   Core     │           │
│  │ Routers │ │ CLI/TG   │ │ Events/LLM │           │
│  └────┬────┘ └────┬─────┘ └─────┬──────┘           │
│       │           │             │                   │
│  ┌────┴───────────┴─────────────┴──────┐            │
│  │          Domain Services             │            │
│  │                                      │            │
│  │  Chat · Growth · Habit · Knowledge   │            │
│  │  Memory · Integration · Automation   │            │
│  │  Insight · Identity                  │            │
│  └──────────────────┬───────────────────┘            │
│                     │                               │
│  ┌──────────────────┴───────────────────┐            │
│  │        Infrastructure                 │            │
│  │  SQLAlchemy 2.0 · pgvector · Alembic  │            │
│  │  Claude/OpenAI/Gemini · Fernet crypto │            │
│  └──────────────────────────────────────┘            │
└──────────────────────┬─────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │   PostgreSQL 17 + pgvector   │
        │        (Supabase)            │
        └─────────────────────────────┘
```

### DDD Bounded Contexts

```
domain/
├── identity/       # Auth, JWT, user profiles
├── chat/           # Chat service, conversation history
├── memory/         # Vector search, embeddings
├── growth/         # Goals, milestones, progress
├── habit/          # Habits, check-ins, streaks, analytics, calendar sync
├── insight/        # Retrospectives, LLM insights
├── integration/    # Google Calendar, intent detection
├── automation/     # Event-driven rules, pattern detection
└── knowledge/      # Documents, chunking, RAG
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.14, FastAPI, SQLAlchemy 2.0 async |
| Frontend | Next.js 14, React 18, Tailwind CSS, Chart.js |
| Database | PostgreSQL 17 + pgvector (Supabase) |
| LLM | Claude API, OpenAI API, Google Gemini |
| Embeddings | Gemini / OpenAI (768d vectors) |
| Auth | JWT (access + refresh tokens) |
| Calendar | Google Calendar API + OAuth2 |
| Events | In-memory event bus + PostgreSQL event store |

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- PostgreSQL with pgvector (or Supabase account)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# .env 설정
cp .env.example .env
# DATABASE_URL, ANTHROPIC_API_KEY 등 설정

# DB 마이그레이션
alembic upgrade head

# 서버 시작
uvicorn alma.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install

# 개발 서버 (API 프록시 → localhost:8000)
npm run dev
```

### CLI Client

```bash
cd backend
source .venv/bin/activate
python -m alma.cli --email user@example.com --password your-password
```

## API Documentation

서버 시작 후: http://localhost:8000/docs (Swagger UI)

### Key Endpoints

| Category | Endpoint | Description |
|----------|----------|-------------|
| Auth | `POST /api/auth/register` | 회원가입 |
| Auth | `POST /api/auth/login` | 로그인 |
| Chat | `WS /api/chat/ws/{id}` | WebSocket 채팅 |
| Chat | `POST /api/chat/message` | REST 채팅 (CLI/Telegram) |
| Goals | `GET/POST /api/goals` | 목표 CRUD |
| Habits | `GET/POST /api/habits` | 습관 CRUD |
| Habits | `POST /api/habits/{id}/checkin` | 체크인 |
| Habits | `GET /api/habits/today` | 오늘 요약 |
| Analytics | `GET /api/habits/analytics/*` | 통계 (히트맵/트렌드/완료율/상관관계) |
| Knowledge | `GET/POST /api/knowledge` | 지식 CRUD |
| Knowledge | `POST /api/knowledge/search` | 벡터 검색 |
| Automations | `GET/POST /api/automations` | 자동화 규칙 |
| LLM | `GET /api/llm/models` | 사용 가능한 모델 목록 |
| Settings | `GET/PUT /api/users/me/preferences` | 사용자 설정 |
| Calendar | `POST /api/integrations/google/connect` | Google Calendar 연동 |
| Telegram | `POST /api/telegram/webhook` | Telegram 봇 webhook |

## Testing

```bash
cd backend
source .venv/bin/activate
export $(grep -v '^#' .env | xargs)

# 전체 테스트
pytest tests/ -v

# 특정 모듈
pytest tests/test_habit_service.py -v
pytest tests/test_automation.py -v
pytest tests/test_knowledge.py -v

# Lint
ruff check src/ tests/
```

## Project Stats

- **84 commits** on `feature/phase1-mvp`
- **222 files** (81 backend, 58 frontend, 29 tests, 23 docs)
- **130+ tests** across all modules
- **40+ API endpoints**
- **9 DDD bounded contexts**

## Environment Variables

```env
# Required
DATABASE_URL=postgresql+asyncpg://...
ANTHROPIC_API_KEY=sk-ant-...

# Optional LLM
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...

# Auth
JWT_SECRET=your-secret-key

# Google Calendar
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8000/api/integrations/google/callback
ENCRYPTION_KEY=...

# Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ALLOWED_USERS=123456,789012
```

## License

Private — All rights reserved.
