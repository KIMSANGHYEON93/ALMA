# VIVARA Process Document

> 이 문서는 VIVARA 프로젝트의 전체 진행 이력과 다음 단계를 기록합니다.
> 새 세션 시작 시 이 문서를 읽어 컨텍스트를 복원합니다.

## 프로젝트 개요

- **이름:** VIVARA — The Origin of Your Life, Visualized
- **미션:** 삶의 모든 데이터에 의미를 부여하고, 관계를 발견하고, 성장의 방향을 제시하는 인지 엔진
- **리포지토리:** https://github.com/KIMSANGHYEON93/ALMA
- **경로:** `~/alma/`

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Backend | Python 3.14, FastAPI, SQLAlchemy 2.0 async, uv |
| Frontend | Next.js 14, React 18, Tailwind CSS, TypeScript |
| Database | Supabase PostgreSQL 17 + pgvector (port 6543, pgbouncer) |
| LLM | Multi-LLM Router: Claude 3 Haiku / GPT-4o-mini / Gemini 2.0 Flash |
| Embedding | EmbeddingProvider Protocol (Gemini 768d / OpenAI 768d / None) |
| Auth | JWT (python-jose) + bcrypt |
| Encryption | Fernet (API 키, OAuth 토큰 at-rest 암호화) |
| Events | InMemoryEventBus + EventStore (append-only DB) |
| Multi-Channel | Web (WebSocket/REST) + Discord + Telegram |
| Visualization | Chart.js, react-force-graph-2d, react-markdown |
| CI | GitHub Actions (ruff + pytest + pgvector) |
| Infra | Docker Compose (nginx + backend + frontend + pgvector) |
| E2E Test | Playwright (16 tests, 8 groups) |
| Test | pytest-asyncio 40+ 파일, SAVEPOINT 격리 |

## DDD 아키텍처

```
backend/src/alma/
├── domain/
│   ├── identity/          ← 인증/사용자/프로필/보안설정
│   ├── chat/              ← 대화 관리 (upstream)
│   ├── memory/            ← 기억/임베딩/벡터검색 (downstream)
│   ├── growth/            ← 목표/마일스톤/대화연동
│   ├── habit/             ← 습관 추적/체크인/분석/캘린더동기화
│   ├── insight/           ← 주간 회고/인사이트 생성
│   ├── knowledge/         ← 문서 관리/청킹/벡터검색
│   ├── automation/        ← 이벤트 기반 자동화 규칙
│   ├── notification/      ← Web Push (VAPID)
│   ├── integration/       ← Google Calendar OAuth/CRUD
│   └── ontology/          ← 지식 그래프 (14파일 + 6 어댑터)
├── core/events/           ← DomainEvent, EventBus, EventStore
├── gateway/               ← ChannelService, Discord, Telegram
├── infrastructure/llm/    ← Multi-LLM Router (Claude/GPT/Gemini)
├── api/                   ← FastAPI 라우터 20개
├── models/models.py       ← Shared Kernel (25+ ORM 모델)
└── config.py, database.py, main.py, cli.py
```

## 진행 이력

### Phase 1: MVP (2026-03-17) — ✅ 완료

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

**성과:** 인증, 채팅(WebSocket), 3D 랜딩, CI 파이프라인

---

### Phase 2: Memory Enhancement (2026-03-18) — ✅ 완료

| Chunk | 커밋 | 내용 |
|-------|------|------|
| 1 | `b14b4b1` | Vector(1536→768) 마이그레이션 + UserMemory 모델 |
| 1 | `b073a58` | EmbeddingProvider Protocol + MemoryService DI 리팩토링 |
| 2 | `fcd6e6d` | 메시지 페이지네이션 API + Frontend 무한 스크롤 |
| 3 | `022ba6c` | UserProfileService + ChatService 개인화 |
| 4 | `d3173c1` | UserMemoryRepository + 최종 검증 (27 tests) |

**성과:** 벡터 임베딩(768d), 기억 검색, 암묵적 학습, 무한 스크롤

---

### 기반 완성 (2026-03-19) — ✅ 완료

| 커밋 | 내용 |
|------|------|
| `b61d700` | Gemini/OpenAI 임베딩 활성화 + google-genai SDK 전환 |

---

### Phase 3A: Growth Engine (2026-03-19) — ✅ 완료

**내용:**
- Goal CRUD (active/paused/completed/archived)
- Milestone 하위 작업 + 진행률 추적
- GoalConversationLink (대화-목표 연결)
- LLM 기반 목표 제안

**신규 테이블:** goals, milestones, goal_conversation_links
**신규 API:** /api/goals (CRUD + milestones + status + summary)

---

### Phase 3B: Google Calendar Integration (2026-03-19) — ✅ 완료

**내용:**
- OAuth2 워크플로우 (CSRF state JWT + 토큰 교환)
- Calendar CRUD (생성/조회/삭제)
- Fernet 토큰 암호화 (at-rest)
- 자동 토큰 갱신 + 만료 관리
- 채팅 인텐트 감지 ("회의 잡아줘" → 캘린더 이벤트 생성)

**신규 테이블:** integrations, integration_action_logs
**신규 API:** /api/integrations/google/{connect,callback,calendar}

---

### Phase 4: Retrospective & Insights (2026-03-20) — ✅ 완료

**내용:**
- 주간 회고 자동 생성 (50개 메시지 LLM 분석)
- InsightCategory: topic_trend, goal_pattern, activity_pattern, recommendation
- Confidence scoring (>0.8 auto-verify, else draft)
- 인사이트 상태 관리 (new/read/acted_on/ignored)

**신규 테이블:** retrospectives, insights
**신규 API:** /api/insights/{retrospectives,dashboard}
**프론트엔드:** /insights (RetrospectiveCard + InsightCard)

---

### Phase 5-Chunk 1: Habit Tracker Core (2026-03-21) — ✅ 완료

**내용:**
- Habit CRUD (daily, specific_days, times_per_week, every_n_days)
- 체크인 시스템 (value + note, source: ui/chat)
- 스트릭 계산 (빈도 유형별 연속 완료일)
- is_scheduled() 스케줄 판별

**신규 테이블:** habits, habit_logs
**신규 API:** /api/habits (CRUD + checkin + logs + summary)
**프론트엔드:** /habits (HabitCard + HabitForm + HabitTodaySummary)

---

### Phase 5-Chunk 2: Habit Chat + Calendar (2026-03-23) — ✅ 완료

**내용:**
- 채팅 인텐트 감지 (habit.checkin/create/update/delete/today)
- 습관 컨텍스트 시스템 프롬프트 주입
- Google Calendar RRULE 동기화
- 습관 리마인더 메시지

---

### Phase 5-Chunk 3: Habit Analytics (2026-03-23) — ✅ 완료

**내용:**
- HabitAnalyticsService (heatmap, trends, completion, correlations)
- Pearson 상관계수 기반 습관 시너지 탐지
- LLM 코칭 인사이트 생성

**신규 API:** /api/habits/analytics/{heatmap,trends,completion,correlations,insight}
**프론트엔드:** /habits/analytics (Heatmap + TrendChart + CompletionChart + CorrelationMatrix + InsightCard)

---

### Sub-2 Chunk 1: Event Infrastructure (2026-03-24) — ✅ 완료

**내용:**
- DomainEvent (frozen dataclass, UUID, trace_id)
- InMemoryEventBus (pub/sub, type-specific + global handlers)
- EventStoreRepository (PostgreSQL append-only)
- 이벤트 발행: chat.message_processed, habit.*, goal.*, integration.*

**신규 테이블:** events
**core/events/:** models.py, bus.py, helpers.py, store.py

---

### Sub-2 Chunk 2: Automation Engine (2026-03-24) — ✅ 완료

**내용:**
- AutomationService (규칙 CRUD + 이벤트 매칭)
- AutomationEventHandler (EventBus 구독, 이벤트 → 규칙 실행)
- LLM 기반 자동화 제안 (패턴 탐지)
- 액션 타입: notification, log, habit.checkin

**신규 테이블:** automation_rules
**신규 API:** /api/automations (CRUD + toggle + suggest)
**프론트엔드:** /automations (AutomationCard + AutomationForm)

---

### Sub-4: Knowledge Base (2026-03-24) — ✅ 완료

**내용:**
- KnowledgeService (문서 추가 + 청킹 + 임베딩 + 벡터 검색)
- FileParser (PDF/DOCX/TXT 텍스트 추출)
- 오버랩 청킹 전략
- 채팅 컨텍스트에 지식 기반 검색 결과 주입

**신규 테이블:** documents, document_chunks (embedding Vector 768)
**신규 API:** /api/knowledge (CRUD + upload + url + search)
**프론트엔드:** /knowledge (KnowledgeCard + AddKnowledgeModal)

---

### Multi-LLM Router (2026-03-24) — ✅ 완료

**내용:**
- LLMRouter: primary provider + fallback chain
- ClaudeProvider (claude-3-haiku), GeminiProvider (gemini-2.0-flash), OpenAIProvider (gpt-4o-mini)
- 사용자별 API 키 지원 (preferences에 암호화 저장)
- Settings 페이지에서 AI 모델 선택 UI

**신규 API:** GET /api/llm/models
**프론트엔드:** /settings (모델 선택 드롭다운)

---

### Multi-Channel: Discord + Telegram (2026-03-25) — ✅ 완료

**내용:**
- ChannelService (UnifiedMessage → ChatService → UnifiedResponse)
- Discord 웹훅 핸들러 (!help, !id, 길드 허용목록)
- Telegram 웹훅 핸들러 (/start, 사용자 ID 매핑)
- 사용자 preferences.discord_id / telegram_id로 계정 연결

**gateway/:** models.py, service.py, discord_bot.py, telegram.py

---

### Notification System — ✅ 완료

**내용:**
- Web Push (VAPID) 구독/해제/발송
- 실패 엔드포인트 자동 정리

**신규 테이블:** push_subscriptions
**신규 API:** /api/notifications/{vapid-key,subscribe,unsubscribe,test}

---

### Ontology Phase A: Core Infrastructure (2026-03-27) — ✅ 완료

**내용:**
- Knowledge Graph: 노드(objects) + 엣지(links) + 액션
- OntologyService: CRUD, 그래프 쿼리, 임베딩 생성
- PurificationPipeline: dedup → validate → normalize → confidence gate
- SemanticExtractor: LLM 텍스트 → 구조화 추출
- SystemSeed: 13 ObjectTypes, 10 LinkTypes, 7 ActionTypes
- 5개 도메인 어댑터 (Goal, Habit, Chat, Memory, Knowledge → 온톨로지 동기화)

**신규 테이블:** ontology_object_types, ontology_objects, ontology_link_types, ontology_links, ontology_action_types, ontology_action_logs
**카테고리:** Entity (Person/Project/Goal/Habit/Task), Concept (Topic/Skill/Value), Attribute (Metric/Emotion), Temporal (Event/Period)
**링크 타입:** supports, blocks, causes, part_of, related_to, depends_on, measured_by, belongs_to, precedes, contradicts

---

### Ontology Phase B: Graph Visualization (2026-03-28) — ✅ 완료

**내용:**
- react-force-graph-2d 기반 인터랙티브 그래프
- 카테고리별 노드 색상, 연결 수 비례 크기
- 필터링 (카테고리, confidence 임계값, 검색)
- 포커스 모드 (노드 클릭 → 이웃 강조)
- 상세 사이드 패널 (속성 + 관계)

**프론트엔드:** /ontology/graph (GraphView + GraphToolbar + NodeDetailPanel)

---

### Ontology Phase C: Inference Engine (2026-03-28) — ✅ 완료

**내용:**
- GraphAnalyzer: hub_pattern, isolated, bottleneck, synergy, gap 탐지
- InsightGenerator: LLM 기반 패턴 해석 + 추천 생성
- 인사이트 상태 관리

**신규 테이블:** ontology_insights
**신규 API:** /api/ontology/insights, /api/ontology/analysis/{generate-insights}
**프론트엔드:** /ontology/insights

---

### Ontology Phase D: Agent Automation (2026-03-28) — ✅ 완료

**내용:**
- ActionPlanner: LLM 기반 행동 계획 분해
- ActionExecutor: 계획 실행 (노드/링크 생성, 알림, 제안)
- OntologyAutomation: 인사이트 타입 → 액션 규칙

**신규 테이블:** ontology_automations, ontology_automation_logs
**신규 API:** /api/ontology/automations (CRUD + execute + logs)
**프론트엔드:** /ontology/automations

---

### Ontology Import & Data Reconciliation (2026-03-29) — ✅ 완료

**내용:**
- ImportScanner: 마크다운 디렉토리 스캔
- ImportProcessor: 파일 → LLM 추출 → 파이프라인 정제
- DB 소스 임포트 (goals/habits/memories → 온톨로지)
- 중복 감지 (임베딩 유사도), 병합 전략

**신규 테이블:** import_sources
**신규 API:** /api/ontology/import/{scan,process,db-source,sources}
**프론트엔드:** /ontology/import

---

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

## DB 테이블 현황 (25+)

| 테이블 | 바운디드 컨텍스트 | 비고 |
|--------|-------------------|------|
| users | identity | preferences JSONB (프로필 학습, 암호화 API 키) |
| conversations | chat | — |
| messages | chat/memory | embedding Vector(768) |
| action_logs | integration | 인텐트 감지 로그 |
| user_memories | memory | 구조화된 기억, embedding Vector(768) |
| goals | growth | status, category, target_date |
| milestones | growth | goal_id FK |
| goal_conversation_links | growth | 대화-목표 연결 |
| habits | habit | frequency JSONB, calendar_event_id |
| habit_logs | habit | 일일 체크인 기록 |
| retrospectives | insight | 주간 요약 |
| insights | insight | category (topic/goal/activity/habit_pattern) |
| documents | knowledge | source_type (text/url/file) |
| document_chunks | knowledge | embedding Vector(768) |
| integrations | integration | 암호화된 OAuth 토큰 |
| integration_action_logs | integration | — |
| events | core | 도메인 이벤트 append-only 스토어 |
| automation_rules | automation | 이벤트 트리거 → 액션 |
| push_subscriptions | notification | Web Push VAPID |
| ontology_object_types | ontology | 시스템 + 사용자 정의 |
| ontology_objects | ontology | 노드 (draft/verified/merged/archived) |
| ontology_link_types | ontology | 10종 관계 타입 |
| ontology_links | ontology | 엣지 (confidence 기반) |
| ontology_action_types | ontology | 실행 가능 액션 |
| ontology_action_logs | ontology | 액션 실행 이력 |
| ontology_insights | ontology | 그래프 분석 인사이트 |
| ontology_automations | ontology | 인사이트 기반 규칙 |
| ontology_automation_logs | ontology | 자동화 실행 로그 |
| import_sources | ontology | 임포트 소스 추적 |

## 현재 프로젝트 규모

| 항목 | 수량 |
|------|------|
| 바운디드 컨텍스트 | 11개 (identity, chat, memory, growth, habit, insight, knowledge, automation, notification, integration, ontology) |
| 백엔드 도메인 파일 | 50+ |
| API 라우터 | 20개 |
| DB 테이블 | 25+ |
| Alembic 마이그레이션 | 17개 |
| 프론트엔드 페이지 | 15개 (13 routes + 2 sub-routes) |
| 프론트엔드 컴포넌트 | 28+ |
| 커스텀 훅 | 19개 |
| 백엔드 테스트 파일 | 40+ |
| E2E 테스트 | 16개 (8 groups) |

## 환경 설정

### .env (backend/)
```
DATABASE_URL=postgresql+asyncpg://postgres.xxx:***@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
ANTHROPIC_API_KEY=sk-ant-***
GEMINI_API_KEY=AIza***
OPENAI_API_KEY=sk-proj-***
JWT_SECRET=alma-dev-secret-change-in-production
FERNET_KEY=***
GOOGLE_CLIENT_ID=***
GOOGLE_CLIENT_SECRET=***
VAPID_PRIVATE_KEY=***
VAPID_PUBLIC_KEY=***
DISCORD_BOT_TOKEN=***
DISCORD_ALLOWED_GUILDS=***
```

### 서버 실행
```bash
# Backend
cd ~/alma/backend && source .venv/Scripts/activate
uvicorn alma.main:app --host 0.0.0.0 --port 8000

# Frontend
cd ~/alma/frontend && npm run dev

# Docker (full stack)
cd ~/alma && docker-compose up -d

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

## 다음 단계 후보

| 우선순위 | 영역 | 설명 |
|----------|------|------|
| **1** | 테스트 검증 | 40+ 테스트 파일 전체 통과 확인 + E2E 재검증 |
| **2** | 배포 | Vercel(FE) + Railway/Render(BE) 프로덕션 배포 |
| **3** | 실사용 검증 | 전 기능 E2E 시나리오 통합 테스트 |
| **4** | 성능 최적화 | 온톨로지 그래프 대규모 노드 렌더링, LLM 호출 캐싱 |
| **5** | 보안 강화 | Rate limiting, CORS 세부 설정, API 키 로테이션 |

---

*마지막 업데이트: 2026-04-08*
*상세 spec/plan: `docs/superpowers/{specs,plans}/`*
