# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VIVARA — The Origin of Your Life, Visualized
- Mission: 삶의 모든 데이터에 의미를 부여하고, 관계를 발견하고, 성장의 방향을 제시하는 인지 엔진
- Architecture: DDD (Domain-Driven Design) + SDD (Spec-Driven Design) + Event Sourcing
- Stack: FastAPI + Next.js 14 + Supabase PostgreSQL 17/pgvector + Multi-LLM (Claude/GPT-4o/Gemini) + Embeddings (Gemini/OpenAI)

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

# CLI chat
python -m alma.cli
```

### Frontend (from `frontend/`)
```bash
npm run dev       # Dev server (port 3000, proxies /api/* → localhost:8000)
npm run build     # Production build
npm run lint      # ESLint

# E2E tests (Playwright)
npx playwright test
```

### Docker (from root)
```bash
docker-compose up -d                   # Full stack (db + backend + frontend + nginx)
docker-compose --profile test up db-test  # Test DB only
```

## Architecture

### Backend: DDD Bounded Contexts
```
backend/src/alma/
├── domain/
│   ├── identity/              Bounded Context: 인증/사용자
│   │   ├── service.py           JWT 생성/검증, bcrypt 해싱
│   │   ├── repository.py        UserRepository (CRUD)
│   │   ├── profile.py           UserProfileService (명시적+암묵적 선호 학습)
│   │   └── secure_prefs.py      API 키 Fernet 암호화/복호화/마스킹
│   ├── chat/                  Bounded Context: 대화 (upstream)
│   │   ├── service.py           ChatService (memory → LLM → integration → response)
│   │   └── repository.py        ConversationRepo, MessageRepo (cursor pagination)
│   ├── memory/                Bounded Context: 기억 (downstream, conformist)
│   │   ├── service.py           MemoryService (저장 + 임베딩 + 벡터 검색)
│   │   ├── embedding.py         EmbeddingProvider Protocol (Gemini > OpenAI > None)
│   │   ├── models.py            SearchQuery, SearchResult 값 객체
│   │   └── repository.py        UserMemoryRepository (구조화된 기억 + vector search)
│   ├── growth/                Bounded Context: 성장 관리
│   │   ├── service.py           GoalService (CRUD + progress + 대화 연동)
│   │   ├── repository.py        GoalRepo, MilestoneRepo, LinkRepo
│   │   └── models.py            GoalStatus, GoalCategory Enum
│   ├── habit/                 Bounded Context: 습관 추적
│   │   ├── service.py           HabitService (CRUD + checkin + streak + today summary)
│   │   ├── repository.py        HabitRepository, HabitLogRepository
│   │   ├── models.py            FrequencyType, HabitStatus, CheckinSource Enum
│   │   ├── analytics.py         HabitAnalyticsService (heatmap, trends, correlations, LLM coaching)
│   │   └── calendar_sync.py     HabitCalendarSync (RRULE → Google Calendar)
│   ├── insight/               Bounded Context: 회고/인사이트
│   │   ├── service.py           InsightService (주간 회고 생성, 대시보드)
│   │   ├── repository.py        RetrospectiveRepo, InsightRepo
│   │   └── models.py            InsightCategory enum
│   ├── knowledge/             Bounded Context: 지식 기반
│   │   ├── service.py           KnowledgeService (문서 추가 + 청킹 + 벡터 검색)
│   │   ├── repository.py        DocumentRepo, DocumentChunkRepo
│   │   └── parser.py            PDF/DOCX/TXT 텍스트 추출
│   ├── automation/            Bounded Context: 자동화
│   │   ├── service.py           AutomationService (규칙 CRUD + 이벤트 매칭 + 실행)
│   │   ├── repository.py        AutomationRuleRepository
│   │   └── handler.py           AutomationEventHandler (EventBus 구독)
│   ├── notification/          Bounded Context: 알림
│   │   └── service.py           NotificationService (Web Push VAPID)
│   ├── integration/           Bounded Context: 외부 연동
│   │   ├── service.py           IntegrationService (인텐트 감지 + Calendar 연동)
│   │   ├── repository.py        ActionLogRepo + IntegrationRepo
│   │   ├── oauth.py             GoogleOAuthService (OAuth2 + CSRF state)
│   │   ├── calendar.py          GoogleCalendarProvider (asyncio.to_thread)
│   │   └── crypto.py            Fernet 토큰 암호화/복호화
│   └── ontology/              Bounded Context: 지식 그래프 (최대 규모)
│       ├── service.py           OntologyService (노드/엣지 CRUD, 그래프 쿼리)
│       ├── models.py            NodeCandidate, EdgeCandidate, RawExtraction 등
│       ├── repository.py        ObjectType/Object/LinkType/Link/ActionType/ActionLog/Insight/Automation Repos
│       ├── pipeline.py          PurificationPipeline (dedup → validate → normalize → confidence)
│       ├── extractor.py         SemanticExtractor (LLM 텍스트 → 구조화 추출)
│       ├── analyzer.py          GraphAnalyzer (허브, 고립, 경로, 충돌, 기회 분석)
│       ├── action_planner.py    ActionPlanner (LLM 기반 행동 계획 생성)
│       ├── action_executor.py   ActionExecutor (계획 실행: 노드/링크 생성, 알림)
│       ├── insight_generator.py InsightGenerator (그래프 패턴 → LLM 인사이트)
│       ├── dedup.py             DeduplicationService (임베딩 유사도 중복 감지)
│       ├── validator.py         SchemaValidator (카테고리 검증, 속성 정규화)
│       ├── seed.py              SystemSeed (13 ObjectTypes, 10 LinkTypes, 7 ActionTypes)
│       ├── importer.py          ImportScanner + ImportProcessor (마크다운/DB 임포트)
│       └── adapters/            도메인 어댑터 (이벤트 → 온톨로지 동기화)
│           ├── base.py            OntologyAdapter Protocol
│           ├── goal_adapter.py    Goal → 온톨로지 노드/링크
│           ├── habit_adapter.py   Habit → 온톨로지 노드/링크
│           ├── chat_adapter.py    대화 → 토픽/감정 추출
│           ├── memory_adapter.py  기억 → 명시적 사실 노드
│           └── knowledge_adapter.py 문서 → 엔티티/관계 추출
│
├── core/                      Cross-cutting: 이벤트 시스템
│   └── events/
│       ├── models.py            DomainEvent (frozen dataclass)
│       ├── bus.py               InMemoryEventBus (pub/sub)
│       ├── helpers.py           emit() async 헬퍼
│       └── store.py             EventStoreRepository + EventStoreHandler (DB 영속화)
│
├── gateway/                   Multi-Channel 게이트웨이
│   ├── models.py              UnifiedMessage, UnifiedResponse
│   ├── service.py             ChannelService (통합 메시지 처리)
│   ├── discord_bot.py         Discord 웹훅 핸들러 (!help, !id)
│   └── telegram.py            Telegram 웹훅 핸들러 (/start)
│
├── infrastructure/llm/        LLM 추상화 + 멀티 프로바이더
│   ├── base.py                LLMProvider Protocol, ChatMessage, LLMRequest/Response
│   ├── claude.py              ClaudeProvider (claude-3-haiku-20240307)
│   ├── gemini_provider.py     GeminiProvider (gemini-2.0-flash)
│   ├── openai_provider.py     OpenAIProvider (gpt-4o-mini)
│   └── router.py              LLMRouter (primary + fallback chain)
│
├── api/                       Presentation Layer (FastAPI routers, 20개)
│   ├── auth.py                POST /api/auth/{register,login,refresh}
│   ├── conversations.py       GET/POST/DELETE /api/conversations
│   ├── messages.py            GET /api/conversations/{id}/messages (cursor)
│   ├── chat.py                WebSocket /api/chat/ws/{id}?token=
│   ├── chat_rest.py           POST /api/chat/message (REST 동기 채팅)
│   ├── profile.py             GET/PUT /api/users/me/preferences
│   ├── goals.py               CRUD /api/goals, milestones, status, summary
│   ├── habits.py              CRUD /api/habits, checkin, logs
│   ├── habit_analytics.py     GET /api/habits/analytics/{heatmap,trends,completion,correlations,insight}
│   ├── insights.py            /api/insights/{retrospectives,dashboard}
│   ├── knowledge.py           CRUD /api/knowledge, upload, url, search
│   ├── automations.py         CRUD /api/automations, toggle, suggest
│   ├── integrations.py        /api/integrations/google/{connect,callback,calendar}
│   ├── notifications.py       /api/notifications/{vapid-key,subscribe,unsubscribe,test}
│   ├── llm.py                 GET /api/llm/models
│   ├── ontology.py            CRUD /api/ontology, graph, stats, types
│   ├── ontology_import.py     /api/ontology/import/{scan,process,db-source,sources}
│   ├── ontology_insights.py   /api/ontology/insights, analysis, generate-insights
│   └── ontology_automations.py /api/ontology/automations, execute, logs
│
├── models/models.py           Shared Kernel (25+ ORM 모델)
├── auth/dependencies.py       get_current_user (JWT verification)
├── config.py                  Settings (DB, LLM keys, OAuth, VAPID, Fernet, Discord/Telegram)
├── database.py                async engine + session (pgbouncer statement_cache_size=0)
├── main.py                    FastAPI app (all routers registered)
└── cli.py                     CLI interactive chat client
```

### Chat Processing Flow
```
WebSocket/REST → ChatService.process_message()
  1. store user message + embedding (768d vector)
  2. vector search similar past conversations
  3. retrieve user memories (just-in-time context)
  4. get knowledge base context (semantic search)
  5. get current conversation history
  6. inject habit/goal context into system prompt
  7. build context → call LLM (via LLMRouter: Claude/GPT/Gemini)
  8. detect action intent (calendar/habit/goal)
  9. update user profile (implicit learning)
  10. store assistant response
  11. emit domain event → EventBus → Automation/Ontology
  12. send via WebSocket/REST response
```

### Event Flow
```
Domain Action → emit(DomainEvent)
  → InMemoryEventBus.publish()
    → EventStoreHandler (DB 영속화)
    → AutomationEventHandler (규칙 매칭 → 실행)
    → OntologyAdapters (지식 그래프 동기화)
```

### Frontend: Next.js 14 App Router
```
frontend/src/
├── middleware.ts               Server-side auth guard (cookie-based)
│                               Protected: /chat,/settings,/goals,/habits,/insights,
│                                          /knowledge,/automations,/ontology
│                               Authenticated: /,/login → redirect to /chat
│
├── app/
│   ├── page.tsx                / — 3D Landing page (Spline iframe + hero + features)
│   ├── login/page.tsx          /login — 이메일/비밀번호 인증
│   ├── chat/page.tsx           /chat — ConversationList + ChatWindow
│   ├── goals/page.tsx          /goals — 목표 대시보드 (split-pane, 마일스톤)
│   ├── habits/page.tsx         /habits — 일일 습관 체크인
│   ├── habits/analytics/       /habits/analytics — 히트맵, 트렌드, 상관관계
│   ├── insights/page.tsx       /insights — 주간 회고 + AI 인사이트
│   ├── knowledge/page.tsx      /knowledge — 지식 문서 관리 (텍스트/URL/파일)
│   ├── automations/page.tsx    /automations — 자동화 규칙 관리
│   ├── settings/page.tsx       /settings — AI 모델 선택, 선호도, OAuth, 푸시 알림
│   ├── ontology/page.tsx       /ontology — 지식 그래프 대시보드
│   ├── ontology/graph/         /ontology/graph — Force-directed 그래프 시각화
│   ├── ontology/import/        /ontology/import — 파일/DB 임포트
│   ├── ontology/insights/      /ontology/insights — 그래프 분석 인사이트
│   └── ontology/automations/   /ontology/automations — 온톨로지 자동화
│
├── components/
│   ├── ChatWindow.tsx          채팅 UI (WebSocket + 무한 스크롤 + 습관 리마인더)
│   ├── ConversationList.tsx    대화 목록 사이드바
│   ├── MessageBubble.tsx       메시지 버블 (React.memo + 목표 추가 액션)
│   ├── ActiveGoalsBanner.tsx   채팅 내 활성 목표 배너
│   ├── AddGoalFromChatModal.tsx 채팅에서 목표 생성 모달
│   ├── GoalCard.tsx            목표 카드 (진행률 바)
│   ├── GoalDetail.tsx          목표 상세 (마일스톤 관리)
│   ├── CreateGoalModal.tsx     목표 생성 모달
│   ├── HabitCard.tsx           습관 체크인 카드 (스트릭 배지)
│   ├── HabitForm.tsx           습관 생성/편집 폼
│   ├── HabitTodaySummary.tsx   오늘의 습관 요약 바
│   ├── HabitHeatmap.tsx        GitHub 스타일 히트맵 (Chart.js matrix)
│   ├── HabitTrendChart.tsx     30일 트렌드 라인 차트
│   ├── HabitCompletionChart.tsx 습관별 완료율 바 차트
│   ├── HabitCorrelationMatrix.tsx 습관 상관관계 매트릭스
│   ├── HabitInsightCard.tsx    AI 습관 코칭 인사이트
│   ├── InsightCard.tsx         인사이트 카드
│   ├── RetrospectiveCard.tsx   주간 회고 카드
│   ├── KnowledgeCard.tsx       지식 문서 카드
│   ├── AddKnowledgeModal.tsx   지식 추가 모달 (텍스트/URL/파일)
│   ├── AutomationCard.tsx      자동화 규칙 카드
│   ├── AutomationForm.tsx      자동화 규칙 생성 폼
│   ├── ontology/               온톨로지 컴포넌트 (8개)
│   │   ├── OntologyStats.tsx     통계 카드
│   │   ├── ObjectList.tsx        노드 목록 (검색/페이지네이션)
│   │   ├── DraftReview.tsx       초안 노드 승인/거부
│   │   ├── GraphView.tsx         Force-directed 그래프 (react-force-graph-2d)
│   │   ├── GraphToolbar.tsx      카테고리 필터, 신뢰도 슬라이더, 검색
│   │   ├── NodeDetailPanel.tsx   노드 상세 사이드 패널
│   │   ├── InsightCard.tsx       온톨로지 인사이트 카드
│   │   └── AutomationCard.tsx    온톨로지 자동화 카드
│   ├── charts/                 차트 공용 컴포넌트
│   │   ├── TrendLineChart.tsx    라인 차트
│   │   └── CompletionBarChart.tsx 바 차트
│   └── common/
│       ├── NavBar.tsx            네비게이션 (VIVARA 로고, 7개 탭, 다크모드 토글)
│       ├── Spinner.tsx           로딩 스피너
│       └── Toast.tsx             토스트 알림
│
├── hooks/                      커스텀 훅 (19개)
│   ├── useMessages.ts          메시지 히스토리 + 상태 관리
│   ├── useChatWebSocket.ts     WebSocket 연결/재연결 + 습관 리마인더
│   ├── useInfiniteScroll.ts    IntersectionObserver 기반
│   ├── useGoals.ts             목표 CRUD + 요약
│   ├── useHabits.ts            습관 CRUD + 체크인 + 오늘 요약
│   ├── useHabitAnalytics.ts    분석 데이터 + LLM 인사이트
│   ├── useInsights.ts          회고/인사이트 대시보드
│   ├── useKnowledge.ts         지식 문서 CRUD + 검색
│   ├── useAutomations.ts       자동화 규칙 CRUD + 토글
│   ├── useIntegrations.ts      Google Calendar 연동 상태
│   ├── useProfile.ts           사용자 선호도 CRUD
│   ├── usePushNotification.ts  Web Push 구독 관리
│   ├── useDarkMode.ts          다크모드 토글 (localStorage)
│   ├── useOntology.ts          온톨로지 통계/객체 관리
│   ├── useOntologyGraph.ts     그래프 데이터 (노드 + 엣지)
│   ├── useOntologyInsights.ts  온톨로지 인사이트 + 분석
│   ├── useOntologyAutomations.ts 온톨로지 자동화 + 로그
│   └── useOntologyImport.ts    파일 스캔/임포트/DB 임포트
│
├── contexts/AuthContext.tsx    AuthProvider + useAuth() (token, isLoading, logout)
└── lib/
    ├── api.ts                  apiClient (401 인터셉터 + skipAuthRedirect)
    ├── auth.ts                 토큰 관리 (localStorage + cookie 동시 저장)
    ├── websocket.ts            WebSocket 유틸리티
    ├── types.ts                전체 TypeScript 인터페이스 (OpenAPI 기반)
    └── events.ts               커스텀 이벤트 (GOALS_CHANGED 등 cross-page 동기화)
```

## DB Tables (25+)

| 테이블 | 바운디드 컨텍스트 | 비고 |
|--------|-------------------|------|
| users | identity | preferences JSONB (프로필 학습, 암호화된 API 키) |
| conversations | chat | — |
| messages | chat/memory | embedding Vector(768) |
| action_logs | integration | 인텐트 감지 로그 |
| user_memories | memory | 구조화된 기억, embedding Vector(768) |
| goals | growth | status, category, target_date |
| milestones | growth | goal_id FK |
| goal_conversation_links | growth | 대화-목표 연결 |
| habits | habit | frequency JSONB, calendar_event_id |
| habit_logs | habit | 일일 체크인 기록 |
| documents | knowledge | source_type (text/url/file) |
| document_chunks | knowledge | embedding Vector(768), 오버랩 청킹 |
| retrospectives | insight | 주간 요약 |
| insights | insight | category (topic/goal/activity/habit_pattern) |
| integrations | integration | 암호화된 OAuth 토큰 |
| integration_action_logs | integration | — |
| events | core | 도메인 이벤트 append-only 스토어 |
| automation_rules | automation | 이벤트 트리거 → 액션 |
| push_subscriptions | notification | Web Push VAPID |
| ontology_object_types | ontology | 시스템 + 사용자 정의 타입 |
| ontology_objects | ontology | 노드 (status: draft/verified/merged/archived) |
| ontology_link_types | ontology | 관계 타입 (supports, blocks 등 10종) |
| ontology_links | ontology | 엣지 (confidence 기반) |
| ontology_action_types | ontology | 실행 가능 액션 정의 |
| ontology_action_logs | ontology | 액션 실행 이력 |
| ontology_insights | ontology | 그래프 분석 인사이트 |
| ontology_automations | ontology | 인사이트 기반 자동화 규칙 |
| ontology_automation_logs | ontology | 자동화 실행 로그 |
| import_sources | ontology | 임포트 소스 추적 |

## Key Design Decisions

- **Supabase cloud DB** (not local Docker): connect_args requires `statement_cache_size=0` for pgbouncer
- **bcrypt direct** (not passlib): passlib is unmaintained, breaks with bcrypt 4.x
- **redirect_slashes=False**: FastAPI 308 redirect strips Authorization headers
- **Embeddings**: Gemini (`google-genai` 1.68+) → OpenAI → None fallback chain, 768 dimensions
- **SAVEPOINT test isolation**: conftest.py uses nested transactions for repeatable tests against shared Supabase DB
- **asyncio_default_fixture_loop_scope = "function"**: session scope causes event loop mismatch with asyncpg
- **Cookie + localStorage dual token**: middleware.ts (server-side) reads cookie, client reads localStorage
- **Spline iframe embed**: `@splinetool/react-spline` NPM package incompatible with Next.js 14 webpack exports
- **Multi-LLM Router**: LLMRouter tries primary provider, falls back on failure (Claude → Gemini → OpenAI)
- **User-specific API keys**: 사용자 preferences에 암호화 저장, LLM 호출 시 복호화
- **Event Sourcing**: InMemoryEventBus + EventStore (DB 영속화) + AutomationHandler + OntologyAdapters
- **Unified Gateway**: ChannelService로 Web/Discord/Telegram 통합 메시지 처리
- **Ontology Confidence Gating**: LLM 추출 결과 confidence threshold 기반 필터링
- **Docker Compose**: nginx reverse proxy (80) + backend (8000) + frontend (3000) + pgvector DB

## Alembic Notes
- `env.py` uses `create_async_engine` directly (not `engine_from_config`) for pgbouncer connect_args
- `DATABASE_URL` must be set as env var (pydantic-settings .env is NOT auto-loaded by Alembic)
- Autogenerated migrations need manual `import pgvector.sqlalchemy.vector`
- 17 migration files total (initial → vector → integrations → goals → habits → events → ontology)

## Removed Legacy Directories
`repositories/`, `services/`, `llm/` — all replaced by `domain/*/` and `infrastructure/llm/`

## Rules
- All responses in Korean (code/commits in English)
- DDD: bounded contexts, entities, value objects, aggregates
- SDD: Spec first → implement → verify
- First Principles review before every plan/design phase
- Context7 MCP for latest library docs before development
