# ALMA Process Document

> 이 문서는 ALMA 프로젝트의 전체 진행 이력과 다음 단계를 기록합니다.
> 새 세션 시작 시 이 문서를 읽어 컨텍스트를 복원합니다.

## 프로젝트 개요

- **이름:** ALMA (Adaptive Life Management Agent)
- **미션:** "인간이 원하는 삶의 성장을 목표로 하는 미래를 만들어가는 AI 비서"
- **리포지토리:** https://github.com/KIMSANGHYEON93/ALMA
- **브랜치:** `feature/phase1-mvp` (12 commits)
- **경로:** `~/alma/`

## 기술 스택

| 레이어 | 기술 | 비고 |
|--------|------|------|
| Backend | Python 3.14, FastAPI, SQLAlchemy 2.0 async | uv 패키지 매니저 |
| Frontend | Next.js 14, React 18, Tailwind CSS, TypeScript | App Router |
| Database | Supabase PostgreSQL 17 + pgvector | 클라우드 (port 6543, pgbouncer) |
| LLM | Claude API (claude-3-haiku-20240307) | anthropic SDK |
| Embedding | Gemini > OpenAI > None (옵셔널 fallback) | 벡터 검색용 |
| Auth | JWT (python-jose) + bcrypt | access 15분, refresh 7일 |
| CI | GitHub Actions | ruff + pytest + pgvector |
| Test | pytest-asyncio, httpx, SAVEPOINT 격리 | 17개 테스트 |

## 아키텍처 (DDD)

```
backend/src/alma/
├── domain/                         ← 바운디드 컨텍스트
│   ├── identity/                   ← 인증/사용자
│   │   ├── service.py              ← JWT, bcrypt
│   │   └── repository.py           ← UserRepository
│   ├── chat/                       ← 대화 관리
│   │   ├── service.py              ← ChatService (메모리+LLM+인텐트)
│   │   └── repository.py           ← ConversationRepo, MessageRepo
│   ├── memory/                     ← 메모리/임베딩
│   │   └── service.py              ← MemoryService (벡터 검색)
│   └── integration/                ← 외부 연동
│       ├── service.py              ← IntegrationService (Calendar, Notion)
│       └── repository.py           ← ActionLogRepository
├── infrastructure/llm/             ← LLM 추상화
│   ├── base.py                     ← LLMProvider Protocol
│   └── claude.py                   ← Claude 구현
├── models/models.py                ← Shared Kernel (4 ORM 모델)
├── api/                            ← FastAPI 라우터
│   ├── auth.py                     ← POST /api/auth/{register,login,refresh}
│   ├── conversations.py            ← GET/POST /api/conversations
│   └── chat.py                     ← WebSocket /api/chat/ws/{id}
├── auth/dependencies.py            ← get_current_user
├── config.py                       ← Settings (pydantic-settings)
├── database.py                     ← async engine + session
└── main.py                         ← FastAPI app (redirect_slashes=False)

frontend/src/
├── app/page.tsx                    ← 메인 (auth guard + isLoading)
├── app/login/page.tsx              ← 로그인/회원가입
├── components/
│   ├── ChatWindow.tsx              ← WebSocket 채팅
│   ├── ConversationList.tsx        ← 대화 목록 (token guard)
│   └── MessageBubble.tsx           ← 메시지 표시
└── lib/
    ├── api.ts                      ← apiClient (401 인터셉터, skipAuthRedirect)
    ├── auth.ts                     ← 토큰 저장/검증 (빈 문자열 방지)
    └── websocket.ts                ← WebSocket 헬퍼
```

## 진행 이력

### Phase 1: MVP (2026-03-18) — ✅ 완료

#### Chunk 1: 스캐폴딩 + DB
| 커밋 | 내용 |
|------|------|
| `4b56420` | 프로젝트 스캐폴딩 (pyproject.toml, models, config, docker-compose) |
| `fb5b654` | 핵심 백엔드 구현 (Auth, LLM, Repository, Service, API) |
| `055016b` | Frontend 스캐폴딩 + Dockerfile + CI + Supabase 가이드 |
| `65bce42` | Supabase 연결 + Alembic 마이그레이션 + 14 테스트 통과 |

#### Chunk 2: 통합 + E2E
| 커밋 | 내용 |
|------|------|
| `37b28ae` | 병렬 에이전트 통합 (lint/format + frontend build + 추가 테스트 3개) |
| `540a2db` | E2E 대화 성공 (Claude API + 임베딩 옵셔널 + WebSocket 에러 핸들링) |

#### Chunk 3: 프론트엔드 버그 수정
| 커밋 | 내용 |
|------|------|
| `c7b5545` | 미인증 상태 API 호출 에러 수정 (isLoading guard) |
| `4b8cc18` | 401 인증 만료 시 자동 로그인 리다이렉트 + 버튼 피드백 |
| `f934268` | 로그인 후 리다이렉트 (router.push → window.location.href) |
| `82569d2` | 토큰 저장/검증 (빈 문자열 방지, skipAuthRedirect) |
| `793b147` | **308 trailing slash redirect** — 근본 원인 수정 (redirect_slashes=False) |

#### Chunk 4: DDD 리팩토링
| 커밋 | 내용 |
|------|------|
| `060e556` | DDD 바운디드 컨텍스트 구조 도입 + CLAUDE.md 생성 |

### 브라우저 동작 확인 (2026-03-18)
- ✅ 회원가입 (POST /api/auth/register → 201)
- ✅ 로그인 (POST /api/auth/login → 200 → 토큰 저장 → 메인 리다이렉트)
- ✅ 대화 생성 (+ 새 대화 버튼 → POST /api/conversations → 201)
- ✅ Claude 대화 응답 (WebSocket → ChatService → Claude API → 응답 표시)
- ✅ 대화 목록 (GET /api/conversations → 목록 렌더링)

## 해결된 주요 이슈

| 이슈 | 원인 | 해결 |
|------|------|------|
| Docker 미설치 | 로컬 환경 | Supabase 클라우드로 전환 |
| pgbouncer prepared stmt | Supabase port 6543 | `statement_cache_size=0` |
| passlib 호환 깨짐 | bcrypt 4.x 비호환 | bcrypt 직접 사용 |
| 이벤트 루프 불일치 | session 스코프 | function 스코프로 변경 |
| Alembic pgvector import | autogenerate 누락 | 수동 import 추가 |
| Alembic .env 미로딩 | pydantic-settings와 별개 | 환경변수 명시적 설정 |
| 308 redirect | FastAPI trailing slash | redirect_slashes=False |
| 빈 토큰 저장 | 로그인 실패 시 빈 문자열 | saveToken 검증 추가 |
| 401 인터셉터 충돌 | 로그인 API에도 적용 | skipAuthRedirect 옵션 |
| Claude 모델 404 | API 키 접근 제한 | claude-3-haiku-20240307 사용 |

## Plan 작성 시 필수 체크리스트

1. **Task 0: 환경 검증** — 필수 도구 체크 + fallback 경로
2. **라이브러리 유지보수 상태** — 래퍼 라이브러리 피하기
3. **DB connect_args** — pgbouncer 환경별 분기
4. **Alembic 후처리** — autogenerate 후 마이그레이션 검증
5. **테스트 이벤트 루프** — asyncpg는 function 스코프
6. **환경변수 로딩** — pydantic-settings vs os.getenv vs Alembic 독립
7. **API 경로** — trailing slash 제거 (redirect_slashes=False)
8. **제1원칙 리뷰** — 과잉 설계 징후 확인 (YAGNI, 스코프 크리프)

## 구현 전략

| Phase | 방식 | 적용 대상 |
|-------|------|-----------|
| 기반 구축 | 직접 실행 | 스캐폴딩, 설정, 간단 작업 |
| 핵심 구현 | Ralph Loop | 순차 의존성 + TDD 반복 |
| 독립 도메인 | subagent 파견 | 프론트엔드, 독립 서비스 |
| 통합 검증 | 직접 + 코드 리뷰 | E2E, 최종 확인 |

## 환경 설정

### Supabase
- Host: `aws-1-ap-south-1.pooler.supabase.com`
- Port: `6543` (transaction mode, pgbouncer)
- DB: `postgres`
- User: `postgres.hxwumvcbnkcxemfswiye`
- pgvector: 활성화 완료

### .env (backend/)
```
DATABASE_URL=postgresql+asyncpg://postgres.hxwumvcbnkcxemfswiye:***@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
ANTHROPIC_API_KEY=sk-ant-***
OPENAI_API_KEY=          (미설정 — 임베딩 비활성)
GEMINI_API_KEY=          (미설정 — 임베딩 비활성)
JWT_SECRET=alma-dev-secret-change-in-production
```

### 서버 실행
```bash
# Backend
cd ~/alma/backend && source .venv/Scripts/activate
uvicorn alma.main:app --host 0.0.0.0 --port 8000

# Frontend (별도 터미널)
cd ~/alma/frontend && npm run dev

# 브라우저: http://localhost:3000
```

---

## 다음 단계: Phase 2

### Phase 2 후보 (제1원칙 리뷰 필요)

비전 문서(`docs/superpowers/specs/2026-03-17-alma-vision.md`)의 서브 프로젝트:

| 우선순위 | 도메인 | 바운디드 컨텍스트 | 설명 |
|----------|--------|-------------------|------|
| **1** | 메모리 강화 | `domain/memory/` | 임베딩 활성화, 대화 히스토리 표시, 사용자 선호 학습 |
| **2** | 외부 연동 | `domain/integration/` | Google Calendar MCP 실제 연동 |
| **3** | 성장 엔진 | `domain/growth/` (NEW) | 목표 설정, 마일스톤, 회고, 인사이트 |
| **4** | 지식 축적 | `domain/knowledge/` (NEW) | 외부 문서 수집, 벡터 검색 고도화 |
| **5** | 자동화 | `domain/automation/` (NEW) | 반복 작업 감지, 규칙 생성 |
| **6** | UI 개선 | frontend/ | 다크모드, 반응형, 대화 히스토리, 마크다운 렌더링 |
| **7** | 배포 | infra/ | Vercel(FE) + Railway/Render(BE) |

### Phase 2 진입 전 필수 작업

- [ ] 제1원칙 리뷰: Phase 2 스코프 결정 (전부 할 필요 없음)
- [ ] 임베딩 키 설정 (Gemini or OpenAI) → 벡터 검색 활성화
- [ ] 레거시 코드 정리: `auth/auth.py`, `services/`, `repositories/`, `llm/` (domain/으로 이전 완료된 원본)
- [ ] Spec 문서 작성 (SDD: Spec → 구현 → 검증)
- [ ] Plan 작성 (환경 검증 + 교훈 반영)

### DB 테이블 현황 (4개)

| 테이블 | 바운디드 컨텍스트 | Phase 2 확장 가능성 |
|--------|-------------------|---------------------|
| users | identity | preferences JSONB 활용 |
| conversations | chat | tags, summary 추가 가능 |
| messages | chat/memory | embedding 활성화 필요 |
| action_logs | integration | MCP 실제 연동 시 확장 |

### Phase 2에서 추가될 예상 테이블

| 테이블 | 바운디드 컨텍스트 | 용도 |
|--------|-------------------|------|
| goals | growth | 사용자 목표 |
| milestones | growth | 목표 중간 체크포인트 |
| reflections | growth | 회고 기록 |
| knowledge_items | knowledge | 수집된 지식 |

---

*마지막 업데이트: 2026-03-18*
*마지막 커밋: `060e556` (DDD 리팩토링)*
