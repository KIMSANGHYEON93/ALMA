# ALMA Process Document

> 이 문서는 ALMA 프로젝트의 전체 진행 이력과 다음 단계를 기록합니다.
> 새 세션 시작 시 이 문서를 읽어 컨텍스트를 복원합니다.

## 프로젝트 개요

- **이름:** ALMA (Adaptive Life Management Agent)
- **미션:** "인간이 원하는 삶의 성장을 목표로 하는 미래를 만들어가는 AI 비서"
- **리포지토리:** https://github.com/KIMSANGHYEON93/ALMA
- **브랜치:** `feature/phase1-mvp` (23 commits)
- **경로:** `~/alma/`

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Backend | Python 3.14, FastAPI, SQLAlchemy 2.0 async, uv |
| Frontend | Next.js 14, React 18, Tailwind CSS, TypeScript |
| Database | Supabase PostgreSQL 17 + pgvector (port 6543, pgbouncer) |
| LLM | Claude API (claude-3-haiku-20240307), anthropic SDK |
| Embedding | EmbeddingProvider Protocol (Gemini 768d / OpenAI 768d / None) |
| Auth | JWT (python-jose) + bcrypt |
| CI | GitHub Actions (ruff + pytest + pgvector) |
| Test | pytest-asyncio 27개, SAVEPOINT 격리 |

## DDD 아키텍처

```
backend/src/alma/
├── domain/
│   ├── identity/          ← 인증/사용자/프로필
│   │   ├── service.py       JWT, bcrypt
│   │   ├── repository.py    UserRepository
│   │   └── profile.py       UserProfileService (명시적+암묵적 학습)
│   ├── chat/              ← 대화 관리 (upstream)
│   │   ├── service.py       ChatService (메모리+LLM+프로필+인텐트)
│   │   └── repository.py    ConversationRepo, MessageRepo (+페이지네이션)
│   ├── memory/            ← 기억/검색 (downstream, conformist)
│   │   ├── service.py       MemoryService (EmbeddingProvider DI)
│   │   ├── embedding.py     EmbeddingProvider Protocol + Gemini/OpenAI
│   │   ├── models.py        SearchQuery, SearchResult 값 객체
│   │   └── repository.py    UserMemoryRepository (구조화된 기억)
│   └── integration/       ← 외부 연동
│       ├── service.py       IntegrationService
│       └── repository.py    ActionLogRepository
├── infrastructure/llm/    ← LLM 추상화
│   ├── base.py              LLMProvider Protocol
│   └── claude.py            Claude 구현
├── models/models.py       ← Shared Kernel (5 ORM 모델)
├── api/                   ← FastAPI 라우터
│   ├── auth.py              /api/auth/{register,login,refresh}
│   ├── conversations.py     GET/POST /api/conversations
│   ├── messages.py          GET /api/conversations/{id}/messages
│   ├── chat.py              WebSocket /api/chat/ws/{id}
│   └── profile.py           GET/PUT /api/users/me/preferences
├── auth/dependencies.py   ← get_current_user
├── config.py, database.py, main.py
```

## 진행 이력

### Phase 1: MVP (2026-03-18) — ✅ 완료

| 커밋 | 내용 |
|------|------|
| `4b56420` | 프로젝트 스캐폴딩 |
| `fb5b654` | 핵심 백엔드 구현 (Auth, LLM, Repository, Service, API) |
| `055016b` | Frontend + Dockerfile + CI + Supabase 가이드 |
| `65bce42` | Supabase 연결 + Alembic 마이그레이션 + 14 테스트 |
| `37b28ae` | 병렬 에이전트 통합 (lint + build + 테스트 3개) |
| `540a2db` | E2E 대화 성공 (Claude API + 임베딩 옵셔널) |
| `c7b5545`~`793b147` | 프론트엔드 버그 수정 5건 (인증, 토큰, 리다이렉트, 308) |
| `060e556` | DDD 바운디드 컨텍스트 구조 도입 + CLAUDE.md |
| `d5900c2` | 레거시 코드 제거 (-445줄) |

### Phase 2: Memory Enhancement (2026-03-18) — ✅ 완료

| Chunk | 커밋 | 내용 |
|-------|------|------|
| 1 | `b14b4b1` | Vector(1536→768) 마이그레이션 + UserMemory 모델 |
| 1 | `b073a58` | EmbeddingProvider Protocol + MemoryService DI 리팩토링 |
| 2 | `fcd6e6d` | 메시지 페이지네이션 API + Frontend 무한 스크롤 |
| 3 | `022ba6c` | UserProfileService + ChatService 개인화 |
| 4 | `d3173c1` | UserMemoryRepository + 최종 검증 (27 tests) |

### 기반 완성 (2026-03-19)

| 커밋 | 내용 |
|------|------|
| `b61d700` | Gemini/OpenAI 임베딩 활성화 + google-genai SDK 전환 |

- ✅ Gemini 임베딩 768차원 동작 검증
- ✅ Frontend 클린 빌드 통과
- ✅ E2E 8단계 전체 통과 (Auth→Chat→Messages→Preferences)
- ✅ 27/27 테스트 통과

### Phase 2 성과

| 항목 | 결과 |
|------|------|
| 테스트 | 17 → **27개** (+10) |
| DB 테이블 | 4 → **5개** (+user_memories) |
| API 엔드포인트 | 5 → **8개** (+messages, preferences GET/PUT) |
| DDD 도메인 파일 | 7 → **12개** (+embedding, models, repository, profile, api) |
| Claude Memory Tool 패턴 | 구조화된 기억 (user_memories) + 벡터 검색 |

## 해결된 주요 이슈 (전체)

| 이슈 | 해결 |
|------|------|
| Docker 미설치 | Supabase 클라우드 |
| pgbouncer prepared stmt | statement_cache_size=0 |
| passlib 호환 깨짐 | bcrypt 직접 사용 |
| pytest 이벤트 루프 | function 스코프 |
| FastAPI 308 redirect | redirect_slashes=False |
| 빈 토큰 저장 | saveToken/getToken 검증 |
| Alembic HNSW 인덱스 락 | pg_terminate_backend + SET statement_timeout=0 |
| Gemini SDK 동기 호출 | asyncio.to_thread() |
| Vector 차원 불일치 | OpenAI dimensions=768 파라미터 |
| google-generativeai deprecated | google-genai 1.68.0 + gemini-embedding-001 |
| .next 캐시 빌드 실패 | rm -rf .next 클린 빌드 |

## DB 테이블 현황 (5개)

| 테이블 | 바운디드 컨텍스트 | 비고 |
|--------|-------------------|------|
| users | identity | preferences JSONB (프로필 학습) |
| conversations | chat | — |
| messages | chat/memory | embedding Vector(768) |
| action_logs | integration | — |
| user_memories | memory | 구조화된 기억, embedding Vector(768) |

## 환경 설정

### .env (backend/)
```
DATABASE_URL=postgresql+asyncpg://postgres.hxwumvcbnkcxemfswiye:***@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
ANTHROPIC_API_KEY=sk-ant-***
GEMINI_API_KEY=AIza***    (활성 → 벡터 검색 동작)
OPENAI_API_KEY=sk-proj-*** (활성 → fallback)
JWT_SECRET=alma-dev-secret-change-in-production
```

### 서버 실행
```bash
# Backend
cd ~/alma/backend && source .venv/Scripts/activate
uvicorn alma.main:app --host 0.0.0.0 --port 8000

# Frontend
cd ~/alma/frontend && npm run dev

# 브라우저: http://localhost:3000
```

## Plan 작성 체크리스트

1. Task 0: 환경 검증 + fallback 경로
2. 래퍼 라이브러리 피하기 (직접 사용 우선)
3. DB connect_args — pgbouncer 환경별 분기
4. Alembic — autogenerate 후 마이그레이션 검증 + 수동 인덱스 처리
5. 테스트 — asyncpg function 스코프 + SAVEPOINT 격리
6. API 경로 — trailing slash 제거
7. 제1원칙 리뷰 — YAGNI, 스코프 크리프 확인

## 다음 단계: Phase 3 후보

| 우선순위 | 도메인 | 설명 |
|----------|--------|------|
| **1** | 임베딩 활성화 | Gemini API 키 설정 → 벡터 검색 즉시 동작 |
| **2** | 외부 연동 | Google Calendar MCP 실제 연동 |
| **3** | 성장 엔진 | `domain/growth/` — 목표, 마일스톤, 회고, 인사이트 |
| **4** | UI 개선 | 다크모드, 마크다운 렌더링, 프로필 설정 UI |
| **5** | 배포 | Vercel(FE) + Railway/Render(BE) |

---

*마지막 업데이트: 2026-03-19*
*마지막 커밋: `b61d700` (임베딩 활성화, 기반 완성)*
