# ALMA Phase 1 MVP — Spec Document

> **ALMA** — Adaptive Life Management Agent
> "인간이 원하는 삶의 성장을 목표로 하는 미래를 만들어가는 AI 비서"
>
> 비전 문서: `2026-03-17-alma-vision.md`

---

## 제1원칙 검증

| 질문 | 답 |
|------|-----|
| 본질적 목적은? | 대화하고, 기억하고, 대신 행동하는 비서 |
| 최소 동작 단위는? | 사용자↔LLM 대화 + 기억 + 외부 액션 1개 |
| 이것 없이 가치 전달 가능? | 대화 ❌, 기억 ❌, 액션 ❌ → 3개 모두 필수 |
| 지금 자원으로 가능? | ✅ Python + PostgreSQL + Claude API |

---

## 1. 범위

### 포함 (Phase 1)

| 기능 | 설명 |
|------|------|
| 웹 대화 | WebSocket 기반 실시간 채팅 UI |
| LLM 연결 | Claude API (인터페이스 추상화, 구현 1개) |
| 대화 기억 | 이전 대화 저장 + 유사 대화 벡터 검색 |
| 외부 액션 | Google Calendar 또는 Notion MCP 연동 1개 |
| 기본 인증 | JWT 로그인 |
| CI | lint (ruff) + type check (mypy) + test (pytest) |

### 제외 (Phase 2+)

멀티 채널, 멀티 LLM, 이벤트 버스, 자동화 엔진, 온톨로지, 성장 엔진, Output Engine, Transformation Tracker, L2+ 자율성

---

## 2. 기술 스택

| 레이어 | 기술 | 이유 |
|--------|------|------|
| 백엔드 | Python 3.12, FastAPI | 비동기, 타입 힌트, 빠른 개발 |
| 프론트엔드 | Next.js 14, React | SSR, App Router |
| DB | PostgreSQL 16 + pgvector | 관계형 + 벡터 검색 단일 DB |
| LLM | Claude API (anthropic SDK) | 최신 모델, 한국어 우수 |
| 인증 | JWT (python-jose) | 단순, 스테이트리스 |
| 배포 | Docker Compose | 로컬 개발 + 클라우드 동일 환경 |
| 마이그레이션 | Alembic | SQLAlchemy 기반 |
| CI | GitHub Actions | ruff + mypy + pytest |

---

## 3. 아키텍처

```
┌─────────────────────────────────────────────┐
│  Next.js Frontend                            │
│  ├── 채팅 UI (WebSocket)                     │
│  └── 로그인/대화 목록                         │
└────────────┬────────────────────────────────┘
             │ WebSocket / REST
             ▼
┌─────────────────────────────────────────────┐
│  FastAPI Backend                             │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ Chat     │ │ Memory   │ │ Integration │ │
│  │ Service  │ │ Service  │ │ Service     │ │
│  │          │ │          │ │             │ │
│  │ - 대화   │ │ - 저장   │ │ - MCP 액션  │ │
│  │ - LLM    │ │ - 검색   │ │ - 로그      │ │
│  └────┬─────┘ └────┬─────┘ └──────┬──────┘ │
│       │            │               │        │
│       ▼            ▼               ▼        │
│  ┌──────────────────────────────────────┐   │
│  │  LLM Interface (Protocol)            │   │
│  │  └── ClaudeProvider (구현)            │   │
│  └──────────────────────────────────────┘   │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│  PostgreSQL + pgvector                       │
│  ├── users, conversations, messages          │
│  └── action_logs                             │
└─────────────────────────────────────────────┘
```

**직접 함수 호출. 이벤트 버스 없음. 단순함이 핵심.**

---

## 4. 디렉토리 구조

```
alma/
├── backend/
│   ├── src/alma/
│   │   ├── api/               # FastAPI 라우터
│   │   │   ├── chat.py        # WebSocket 채팅 엔드포인트
│   │   │   ├── auth.py        # 로그인/회원가입
│   │   │   └── conversations.py # 대화 목록/검색
│   │   ├── services/          # 비즈니스 로직
│   │   │   ├── chat.py        # 대화 처리
│   │   │   ├── memory.py      # 기억 저장/검색
│   │   │   └── integration.py # 외부 액션
│   │   ├── llm/               # LLM 추상화
│   │   │   ├── base.py        # Protocol 인터페이스
│   │   │   └── claude.py      # Claude 구현체
│   │   ├── models/            # SQLAlchemy 모델
│   │   │   └── models.py
│   │   ├── repositories/      # DB 접근 계층
│   │   │   └── repositories.py
│   │   ├── auth/              # JWT 인증
│   │   │   └── auth.py
│   │   ├── config.py          # 설정
│   │   └── main.py            # FastAPI 앱
│   ├── tests/
│   │   ├── test_chat.py
│   │   ├── test_memory.py
│   │   └── test_integration.py
│   ├── alembic/               # DB 마이그레이션
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx       # 메인 (채팅)
│   │   │   ├── login/
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   └── ConversationList.tsx
│   │   └── lib/
│   │       ├── api.ts         # API 클라이언트
│   │       └── websocket.ts   # WebSocket 클라이언트
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── docs/superpowers/specs/
└── .github/workflows/ci.yml
```

---

## 5. 핵심 인터페이스 (Spec)

### 5.1 LLM 인터페이스

```python
@dataclass(frozen=True)
class ChatMessage:
    role: str          # "user", "assistant", "system"
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

### 5.2 Memory 서비스

```python
class MemoryService:
    async def store_message(self, conversation_id: str,
                            role: str, content: str) -> None:
        """메시지 저장 + 임베딩 생성"""

    async def search_similar(self, user_id: str,
                             query: str, limit: int = 5) -> list[ChatMessage]:
        """유사한 과거 대화 벡터 검색"""

    async def get_conversation_history(self, conversation_id: str,
                                       limit: int = 20) -> list[ChatMessage]:
        """최근 대화 이력 조회"""
```

### 5.3 Chat 서비스 (핵심 흐름)

```python
class ChatService:
    async def process_message(self, user_id: str,
                              conversation_id: str,
                              content: str) -> str:
        """
        1. 사용자 메시지 저장
        2. 유사 과거 대화 검색 (컨텍스트 보강)
        3. 현재 대화 이력 조회
        4. LLM에 요청 (과거 컨텍스트 + 현재 대화)
        5. 응답 저장
        6. 액션 필요 시 Integration 호출
        7. 응답 반환
        """
```

### 5.4 Integration 서비스

```python
class IntegrationService:
    async def execute_action(self, user_id: str,
                             service: str, action: str,
                             params: dict) -> dict:
        """MCP 액션 실행 + 로그 저장"""

    async def detect_action_intent(self, llm_response: str) -> ActionIntent | None:
        """LLM 응답에서 액션 의도 감지"""

@dataclass
class ActionIntent:
    service: str       # "calendar" or "notion"
    action: str        # "create_event", "list_events"
    params: dict
    needs_confirmation: bool  # L1: 사용자 확인 필요
```

---

## 6. 데이터베이스

### 4개 테이블

```sql
-- 사용자
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    preferences JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 대화
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_conversations_user ON conversations (user_id, updated_at DESC);

-- 메시지 (대화 기억의 핵심)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,        -- user, assistant, system
    content TEXT NOT NULL,
    embedding vector(1536),            -- 유사 검색용
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at);
CREATE INDEX idx_messages_embedding ON messages USING hnsw (embedding vector_cosine_ops);

-- 액션 로그
CREATE TABLE action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    service VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    params JSONB NOT NULL DEFAULT '{}',
    result JSONB,
    success BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_actions_user ON action_logs (user_id, created_at DESC);
```

---

## 7. 인증

```
JWT (Access Token + Refresh Token)
├── Access Token: 15분 만료
├── Refresh Token: 7일 만료
├── 비밀번호: bcrypt 해싱
└── API 키 인증: Phase 2 (CLI/봇용)
```

---

## 8. 핵심 메시지 흐름

```
사용자: "내일 오후 2시에 팀 회의 잡아줘"
│
▼ WebSocket
ChatService.process_message()
│
├── 1. MemoryService.store_message() → DB 저장 + 임베딩
│
├── 2. MemoryService.search_similar("회의 일정")
│      → 과거: "이전에 팀 회의는 보통 1시간, 회의실 A 선호"
│
├── 3. MemoryService.get_conversation_history()
│      → 현재 대화 맥락
│
├── 4. LLMProvider.complete([과거 컨텍스트 + 현재 대화])
│      → "내일 오후 2시에 1시간 팀 회의를 잡을까요? 회의실 A로?"
│
├── 5. IntegrationService.detect_action_intent()
│      → ActionIntent(service="calendar", action="create_event",
│         params={date: "내일", time: "14:00", duration: "1h"},
│         needs_confirmation=True)  ← L1: 확인 필요
│
├── 6. 사용자에게 확인 요청
│      → "내일 14:00-15:00 팀 회의를 캘린더에 추가할까요?"
│
├── 7. 사용자: "응"
│      → IntegrationService.execute_action() → Google Calendar MCP
│      → action_logs에 기록
│
└── 8. "내일 오후 2시 팀 회의가 캘린더에 추가되었습니다 ✅"
```

---

## 9. CI/CD

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
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -e ".[dev]"
      - run: ruff check src/
      - run: mypy src/
      - run: pytest tests/ --cov=alma --cov-report=term

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

---

## 10. Phase 2 확장 준비 (인터페이스만)

Phase 1에서 구현하지 않지만, 확장을 위해 인터페이스만 설계해둠:

```python
# LLM: 다른 Provider 추가 시 이 Protocol만 구현
class LLMProvider(Protocol):
    async def complete(self, request: LLMRequest) -> LLMResponse: ...

# 채널: 다른 채널 추가 시 이 패턴만 따름
# Phase 1은 WebSocket만. Telegram 등은 같은 ChatService를 호출

# 자동화: Phase 2에서 패턴 감지 추가 시
# action_logs 테이블이 학습 데이터가 됨 (이미 축적 중)
```

---

## 11. 성공 기준

| 항목 | 기준 |
|------|------|
| 대화 | 웹 UI에서 실시간 채팅 동작 |
| 기억 | 과거 대화 맥락이 응답에 반영됨 |
| 액션 | Google Calendar 또는 Notion 1개 액션 동작 |
| 인증 | JWT 로그인/로그아웃 동작 |
| CI | ruff + mypy + pytest 자동 실행, 커버리지 >80% |
| 배포 | docker-compose up으로 전체 스택 실행 |

---

## 12. 비용

| 항목 | 월 비용 |
|------|---------|
| PostgreSQL (Docker 로컬) | $0 |
| Claude API (개인 사용) | $5~20 |
| **합계** | **$5~20/월** |
