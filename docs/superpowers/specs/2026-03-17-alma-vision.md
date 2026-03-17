# ALMA Core Platform — Spec Document

> **ALMA** — Adaptive Life Management Agent
> "인간이 원하는 삶의 성장을 목표로 하는 미래를 만들어가는 AI 비서"

## 0. 유비쿼터스 언어 (Ubiquitous Language)

| 용어 | 컨텍스트 | 정의 |
|------|----------|------|
| Message | Gateway | 사용자가 채널을 통해 보낸 원본 입력 |
| Request | Core.LLM | LLM에 전달할 통합 요청 |
| Event | Core.Events | 시스템 내 발생한 사실의 불변 기록 |
| Pattern | Automation | 이벤트 시퀀스에서 감지된 반복 행동 |
| Rule | Automation | 패턴에 대한 자동화 실행 규칙 |
| Trigger | Automation | 규칙이 발동되는 조건 |
| Action | Integration | 외부 서비스에 대한 실행 명령 |
| Provider | Core.LLM | 개별 LLM 서비스 연결 |
| Channel | Gateway | 사용자와 소통하는 인터페이스 (Web, Telegram 등) |
| Session | Gateway | 채널별 사용자의 대화 컨텍스트 |
| Adapter | Gateway/Integration | 외부 시스템과 내부 모델 간 변환 계층 |
| Embedding | Knowledge | 텍스트의 벡터 표현 |
| Goal | Growth | 사용자가 달성하려는 삶의 목표 |
| Milestone | Growth | 목표 달성 과정의 중간 체크포인트 |
| Reflection | Growth | 목표 대비 진행 상황에 대한 회고 |
| GrowthLoop | Growth | 목표 → 행동 → 회고 → 조정의 반복 사이클 |
| Insight | Growth | ALMA가 사용자 데이터에서 발견한 성장 관련 인사이트 |
| AgentMaturity | Growth | ALMA 자체의 학습 수준 (사용자 이해도, 자동화 정확도) |

---

## 1. 프로젝트 개요

### 1.1 미션
스스로 학습하고 성장하는 개인형 AI 비서. 사용자의 성장을 돕고, 대화를 기억하며, 지식을 축적하고, 반복 작업을 자동화한다.

### 1.2 성장 철학

ALMA에서 **성장**은 세 가지 축으로 정의된다:

| 성장 축 | 주체 | 설명 |
|---------|------|------|
| **사용자의 성장** | 인간 | 목표 설정 → 진행 추적 → 회고 → 다음 단계 제시. ALMA가 사용자의 삶의 방향을 이해하고 성장 여정을 함께한다 |
| **에이전트의 성장** | ALMA | 대화할수록 사용자를 더 잘 이해하고, 더 정확한 자동화를 수행하며, 더 관련성 높은 지식을 제공한다 |
| **상호 성장** | 함께 | 사용자가 ALMA를 가르치고, ALMA가 사용자에게 인사이트를 제공하는 양방향 성장 루프 |

### 1.3 핵심 원칙

| 원칙 | 설명 |
|------|------|
| 성장 지향 | 사용자의 목표와 성장을 최우선으로 지원하고 추적 |
| 인간 중심 | AI가 결정하지 않고, 사용자의 목표를 이해하고 보조 |
| 자율 성장 | 사용자와 함께 성장하며 점점 더 유용해지는 에이전트 |
| 삶의 질 향상 | 반복 작업 자동화로 인간이 중요한 일에 집중할 시간 확보 |
| 개인 주권 | 데이터와 지식은 사용자가 소유, 프라이버시 최우선 |

### 1.3 핵심 기능 (전체)

| 기능 | 설명 | 서브 프로젝트 |
|------|------|-------------|
| **성장 시스템** | 목표 설정/추적, 회고, 인사이트, 성장 루프 | Sub-5 Growth |
| 대화 기억 | 사용자 선호도/습관 학습, 맞춤화 | Sub-3 Memory |
| 지식 축적 | 외부 문서/데이터 수집, 벡터 검색 | Sub-4 Knowledge |
| 행동 자율화 | 반복 작업 감지, 자동화 규칙 생성 | Sub-2 Automation |
| 멀티 채널 | 웹, CLI, 메신저, API | Sub-1 Core |
| 멀티 LLM | Claude, GPT, Ollama 등 전환 | Sub-1 Core |
| MCP 연동 | Google Calendar, Notion 등 외부 서비스 | Sub-1.5 Integration |

### 1.4 기술 스택

| 레이어 | 기술 |
|--------|------|
| 백엔드 | Python 3.12+, FastAPI |
| 프론트엔드 | React, Next.js 14+ |
| 데이터베이스 | PostgreSQL + pgvector |
| 캐시 | Redis (선택적) |
| LLM | Claude API, OpenAI API, Ollama |
| 배포 | Docker Compose (로컬) / 클라우드 (확장 시) |

### 1.5 아키텍처 패턴

- **모듈러 모노리스 + 이벤트 기반**
- **DDD (Domain-Driven Design)**: 바운디드 컨텍스트, 애그리게이트, 리포지토리 패턴
- **SDD (Spec-Driven Design)**: 명세 우선 → 구현 → 검증

### 1.6 서브 프로젝트 구조 및 순서

```
Sub-1:   Core Platform    (LLM 라우터, 이벤트 버스, 설정, 인증, 보안)
Sub-1.5: Gateway + Integration (채널 입력 + MCP 액션 실행)
Sub-2:   Automation Engine (패턴 감지, 규칙 생성/실행) ← MVP 우선
Sub-3:   Memory            (대화 기억, 개인화)
Sub-4:   Knowledge Base    (문서 수집, 벡터 검색)
Sub-5:   Growth Engine     (목표 설정/추적, 회고, 인사이트, 성장 루프)
```

---

## 2. 프로젝트 디렉토리 구조

```
alma/
├── backend/
│   ├── src/alma/
│   │   ├── core/                  # 🔵 공유 커널
│   │   │   ├── events/            # 이벤트 버스 + 이벤트 스토어
│   │   │   ├── llm/               # 멀티 LLM 라우터
│   │   │   ├── auth/              # 인증/세션 관리
│   │   │   └── config/            # 설정 관리
│   │   ├── gateway/               # 🟢 멀티 채널 게이트웨이
│   │   │   ├── web/               # WebSocket/REST
│   │   │   ├── cli/               # CLI 인터페이스
│   │   │   ├── telegram/          # 텔레그램 봇
│   │   │   └── discord/           # 디스코드 봇
│   │   ├── integration/           # 🔗 외부 서비스 액션
│   │   │   ├── calendar/          # Google Calendar MCP
│   │   │   ├── notion/            # Notion MCP
│   │   │   └── base.py            # IntegrationAdapter 인터페이스
│   │   ├── automation/            # 🟠 자동화 엔진 (Sub-2)
│   │   ├── memory/                # 🟣 기억/개인화 (Sub-3)
│   │   ├── knowledge/             # 🔴 지식베이스 (Sub-4)
│   │   └── growth/                # 🌱 성장 엔진 (Sub-5)
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── docs/superpowers/specs/
├── .github/workflows/             # CI/CD
└── .ralph/                        # Ralph 자동화
```

---

## 3. 멀티 LLM 라우터

### 3.1 바운디드 컨텍스트: `core.llm`

### 3.2 도메인 모델

| 개념 | 역할 | 타입 |
|------|------|------|
| `LLMProvider` | 개별 LLM 연결 (Claude, GPT, Ollama) | 엔티티 |
| `RoutingStrategy` | 모델 선택 전략 (비용/성능/프라이버시) | 값 객체 |
| `CompletionRequest` | 통합 요청 형식 | 값 객체 |
| `CompletionResponse` | 통합 응답 형식 | 값 객체 |
| `ModelSelector` | 전략 기반 모델 라우팅 | 도메인 서비스 |

### 3.3 애그리게이트: LLMProvider

**애그리게이트 루트**: `LLMProvider`
**불변식**:
- name은 고유해야 한다
- health_check 실패 시 라우팅 대상에서 제외
- 연속 3회 실패 시 서킷 브레이커 OPEN

**발행 이벤트**: `ProviderHealthChanged`, `CompletionFailed`, `CompletionSucceeded`

### 3.4 Spec: 핵심 인터페이스

```python
@dataclass(frozen=True)
class CompletionRequest:
    messages: list[dict]           # [{"role": "user", "content": "..."}]
    model_preference: str | None   # 특정 모델 지정 (선택)
    max_tokens: int = 4096
    temperature: float = 0.7
    system_prompt: str | None = None
    user_id: str | None = None
    privacy_level: str = "normal"  # "normal", "sensitive", "private"
    trace_id: str | None = None    # 분산 추적용

@dataclass(frozen=True)
class CompletionResponse:
    content: str
    model_used: str                # 실제 사용된 모델명
    provider: str                  # 제공자 (claude, openai, ollama)
    input_tokens: int
    output_tokens: int
    latency_ms: float
    finish_reason: str             # "stop", "max_tokens", "error"
    trace_id: str | None = None

class LLMProvider(Protocol):
    name: str
    async def complete(self, request: CompletionRequest) -> CompletionResponse: ...
    async def health_check(self) -> bool: ...

class RoutingStrategy(Protocol):
    def select(self, request: CompletionRequest,
               providers: list[LLMProvider]) -> LLMProvider: ...

class ModelSelector:
    """전략 기반 LLM 라우팅 도메인 서비스"""
    async def route(self, request: CompletionRequest,
                    strategy: RoutingStrategy) -> CompletionResponse: ...
```

### 3.5 라우팅 전략 목록

| 전략 | 설명 |
|------|------|
| `CostOptimized` | 토큰당 비용 최소화 |
| `PerformanceFirst` | 응답 속도/품질 우선 |
| `PrivacyFirst` | 로컬 LLM 우선 (민감 데이터) |
| `Fallback` | 장애 시 자동 대체 |

### 3.6 흐름

```
Request → ModelSelector.route(request, strategy)
              │
              ├─ strategy.select() → Provider 선택
              ├─ provider.complete() → 응답 생성
              ├─ 실패 시 → Fallback 전략으로 재시도
              └─ CompletionResponse 반환
```

---

## 4. 이벤트 버스

### 4.1 바운디드 컨텍스트: `core.events`

### 4.2 도메인 모델

| 개념 | 역할 | 타입 |
|------|------|------|
| `DomainEvent` | 모든 이벤트의 기본 (id, timestamp, source) | 값 객체 |
| `EventBus` | 발행/구독 관리 | 도메인 서비스 |
| `EventStore` | 이벤트 영속화 및 리플레이 | 리포지토리 |
| `EventHandler` | 이벤트 처리 콜백 | 인터페이스 |

### 4.3 Spec: 핵심 인터페이스

```python
@dataclass(frozen=True)
class DomainEvent:
    id: str                        # UUID, 멱등성 키로 사용
    event_type: str
    source: str
    payload: dict
    timestamp: datetime
    aggregate_id: str | None = None
    user_id: str | None = None     # 사용자 추적 (감사/GDPR)
    trace_id: str | None = None    # 분산 추적용
    idempotency_key: str | None = None  # 중복 발행 방지

class EventBus(Protocol):
    async def publish(self, event: DomainEvent) -> None: ...
    def subscribe(self, event_type: str, handler: EventHandler) -> None: ...

class EventStore(Protocol):
    async def append(self, event: DomainEvent) -> None: ...
    async def replay(self, aggregate_id: str) -> list[DomainEvent]: ...
    async def query(self, event_type: str, since: datetime) -> list[DomainEvent]: ...
```

### 4.4 전달 보장 및 멱등성

| 항목 | 정책 |
|------|------|
| 전달 보장 | At-Least-Once (최소 1회 전달) |
| 중복 방지 | `idempotency_key`로 핸들러 중복 실행 방지 |
| 순서 보장 | 같은 `aggregate_id` 내에서 `timestamp` 기준 정렬 |
| Outbox 패턴 | `EventStore.append()` + `NOTIFY`를 단일 트랜잭션으로 실행 |

### 4.5 모듈 간 통신 규칙

| 통신 유형 | 방식 | 예시 |
|-----------|------|------|
| 모듈 간 (비동기) | 이벤트 버스 전용 | Gateway → Core, Core → Integration |
| 동기 요청-응답 | Correlation ID 패턴 | 사용자 메시지 → LLM 응답 대기 |
| 모듈 내부 | 직접 호출 허용 | core.llm 내 ModelSelector → Provider |

**Correlation ID 패턴** (동기 느낌의 비동기 처리):
```python
# Gateway가 메시지 수신 시
correlation_id = generate_id()
await event_bus.publish(MessageReceived(..., trace_id=correlation_id))
response = await response_waiter.wait_for(correlation_id, timeout=30.0)
# Core가 처리 완료 시 ResponseGenerated(trace_id=correlation_id) 발행
# response_waiter가 매칭하여 Gateway에 전달
```

### 4.6 핵심 이벤트 카탈로그

```python
# 채널 이벤트
MessageReceived(channel, user_id, content)
ResponseGenerated(request_id, content)

# 자동화 이벤트
PatternDetected(pattern_id, user_id, actions)
AutomationCreated(rule_id, trigger, action)
AutomationExecuted(rule_id, result)

# 기억 이벤트
ConversationStored(user_id, summary)
PreferenceUpdated(user_id, key, value)

# 지식 이벤트
DocumentIngested(doc_id, source, chunks)
KnowledgeQueried(query, results)

# 통합 이벤트
ActionRequired(service, action, params)
ActionCompleted(service, action, result)
```

### 4.7 이벤트 소싱의 역할

| 목적 | 활용 |
|------|------|
| 자동화 패턴 감지 | 이벤트 시퀀스에서 반복 패턴 추출 |
| 세션 간 연속성 | 이벤트 리플레이로 상태 복원 |
| 개인화 학습 데이터 | 사용자 행동 이력 분석 |
| 감사 추적 | 모든 시스템 행동 기록 |

---

## 5. 멀티 채널 게이트웨이

### 5.1 바운디드 컨텍스트: `gateway`

### 5.2 도메인 모델

| 개념 | 역할 | 타입 |
|------|------|------|
| `ChannelAdapter` | 채널별 메시지 변환 (어댑터 패턴) | 인터페이스 |
| `UnifiedMessage` | 채널 무관 통합 메시지 형식 | 값 객체 |
| `UnifiedResponse` | 채널 무관 통합 응답 형식 | 값 객체 |
| `MessageRouter` | 메시지 → 적절한 모듈로 라우팅 | 도메인 서비스 |
| `Session` | 채널별 사용자 세션 관리 | 엔티티 |

### 5.3 Spec: 핵심 인터페이스

```python
class ChannelAdapter(Protocol):
    channel_name: str
    async def receive(self, raw: Any) -> UnifiedMessage: ...
    async def send(self, response: UnifiedResponse) -> None: ...
    async def connect(self) -> None: ...
    async def disconnect(self) -> None: ...

@dataclass(frozen=True)
class UnifiedMessage:
    channel: str
    user_id: str
    content: str
    message_type: str          # text, image, file, command
    context: dict              # 채널별 메타데이터
    timestamp: datetime

@dataclass(frozen=True)
class UnifiedResponse:
    content: str
    response_type: str         # text, card, action_result
    metadata: dict
```

### 5.4 메시지 흐름

```
[외부 채널] → ChannelAdapter.receive() → UnifiedMessage
    → EventBus.publish(MessageReceived)
    → Core LLM 처리
    → EventBus.publish(ResponseGenerated)
    → ChannelAdapter.send(UnifiedResponse) → [외부 채널]
```

---

## 6. Integration 모듈

### 6.1 바운디드 컨텍스트: `integration`

### 6.2 역할 분리

| 위치 | 역할 | 예시 |
|------|------|------|
| Gateway | 인바운드 (메시지 수신) | Notion 멘션, Slack 메시지 |
| Integration | 아웃바운드 (액션 실행) | 캘린더 생성, 노션 페이지 생성 |

### 6.3 도메인 모델

| 개념 | 역할 | 타입 |
|------|------|------|
| `IntegrationAdapter` | 외부 서비스 액션 실행 인터페이스 | 인터페이스 |
| `ActionRequest` | 통합 액션 요청 | 값 객체 |
| `ActionResult` | 액션 실행 결과 | 값 객체 |

### 6.4 Anti-Corruption Layer (ACL)

외부 서비스 모델을 내부 도메인 모델로 변환하는 계층:

```python
class CalendarACL:
    """Google Calendar API 응답 → 내부 ActionResult 변환"""
    def to_action_result(self, gcal_response: dict) -> ActionResult: ...
    def to_gcal_params(self, action: ActionRequest) -> dict: ...
    def translate_error(self, gcal_error: dict) -> AlmaError: ...

class NotionACL:
    """Notion API 응답 → 내부 ActionResult 변환"""
    def to_action_result(self, notion_response: dict) -> ActionResult: ...
    def to_notion_params(self, action: ActionRequest) -> dict: ...
    def translate_error(self, notion_error: dict) -> AlmaError: ...
```

### 6.5 Spec: 핵심 인터페이스

```python
class IntegrationAdapter(Protocol):
    service_name: str
    async def execute(self, action: ActionRequest) -> ActionResult: ...
    async def health_check(self) -> bool: ...

@dataclass(frozen=True)
class ActionRequest:
    service: str               # "calendar", "notion"
    action: str                # "create_event", "create_page"
    params: dict
    user_id: str
    trace_id: str | None = None

@dataclass(frozen=True)
class ActionResult:
    success: bool
    data: dict | None
    error: AlmaError | None
```

### 6.6 이벤트 흐름

```
Core LLM → ActionRequired 이벤트
    → Integration 모듈 수신
    → IntegrationAdapter.execute()
    → ActionCompleted 이벤트
    → Gateway → 사용자 응답
```

### 6.7 지원 서비스 (초기)

| 서비스 | MCP | 주요 액션 |
|--------|-----|----------|
| Google Calendar | gcal_* | 일정 조회/생성/수정/삭제 |
| Notion | notion-* | 페이지 생성/수정, DB 쿼리, 검색 |

---

## 7. 데이터 저장소

### 7.1 구성: PostgreSQL + pgvector (단일 인스턴스)

```
PostgreSQL
├── 관계형 데이터 (users, rules, sessions, config)
├── pgvector 확장 (문서/대화 임베딩, 유사도 검색)
├── LISTEN/NOTIFY (이벤트 큐)
└── 이벤트 스토어 (events 테이블, JSONB)

Redis (선택적)
└── LLM 응답 캐시, 세션 캐시, 레이트 리밋
```

### 7.2 비용: $15~30/월

### 7.3 리포지토리 패턴

```python
class UserRepository(Protocol):
    async def find_by_id(self, user_id: str) -> User | None: ...
    async def save(self, user: User) -> None: ...

class AutomationRuleRepository(Protocol):
    async def find_active_by_user(self, user_id: str) -> list[AutomationRule]: ...
    async def save(self, rule: AutomationRule) -> None: ...

class EventStoreRepository(Protocol):
    async def append(self, event: DomainEvent) -> None: ...
    async def replay(self, aggregate_id: str) -> list[DomainEvent]: ...
```

### 7.4 핵심 스키마

```sql
-- 사용자
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    display_name VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, inactive, suspended
    channel_ids JSONB NOT NULL DEFAULT '{}',
    preferences JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인증 정보 (채널별)
CREATE TABLE credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL,
    credential_type VARCHAR(50) NOT NULL,  -- jwt, api_key, oauth2, bot_token
    encrypted_value TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_credentials_user ON credentials (user_id, channel);

-- 이벤트 스토어
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id UUID,
    user_id UUID,                              -- 사용자 추적 (GDPR)
    event_type VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    source_module VARCHAR(100) NOT NULL,
    trace_id UUID,                             -- 분산 추적
    idempotency_key VARCHAR(255),              -- 중복 방지
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_events_aggregate ON events (aggregate_id, created_at);
CREATE INDEX idx_events_type ON events (event_type, created_at);
CREATE INDEX idx_events_user ON events (user_id, created_at);
CREATE INDEX idx_events_trace ON events (trace_id);
CREATE UNIQUE INDEX idx_events_idempotency ON events (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 자동화 규칙
CREATE TABLE automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    trigger_pattern JSONB NOT NULL,
    action_config JSONB NOT NULL,
    confidence FLOAT NOT NULL DEFAULT 0.0 CHECK (confidence >= 0 AND confidence <= 1),
    is_active BOOLEAN NOT NULL DEFAULT true,
    execution_count INT NOT NULL DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rules_user ON automation_rules (user_id, is_active);

-- 세션
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    channel VARCHAR(50) NOT NULL,
    context JSONB NOT NULL DEFAULT '{}',
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions (user_id, channel);
CREATE INDEX idx_sessions_expiry ON sessions (expires_at);

-- 벡터 저장소 (pgvector)
CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(50) NOT NULL,  -- 'document', 'conversation', 'knowledge'
    source_id UUID NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),            -- 설정 가능: 모델에 따라 768, 1024, 1536, 3072
    model_name VARCHAR(100) NOT NULL DEFAULT 'text-embedding-ada-002',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_embeddings_vector ON embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_embeddings_source ON embeddings (source_type, source_id);

-- 레이트 리밋 / 토큰 예산
CREATE TABLE user_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
    daily_token_budget INT NOT NULL DEFAULT 100000,
    tokens_used_today INT NOT NULL DEFAULT 0,
    requests_today INT NOT NULL DEFAULT 0,
    budget_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 day'
);
```

**마이그레이션 도구**: Alembic (SQLAlchemy 기반)
**명명 규칙**: `{timestamp}_{description}.py` (예: `20260317_initial_schema.py`)

### 7.5 확장 전략

| 단계 | 전환 | 도메인 코드 변경 |
|------|------|-----------------|
| Phase 2 → 3 | pgvector → Pinecone/Qdrant | 구현체 교체만 |
| Phase 2 → 3 | LISTEN/NOTIFY → Redis Pub/Sub | 구현체 교체만 |
| Phase 2 → 3 | 단일 PG → PG + 전용 벡터 DB | 구현체 교체만 |

---

## 8. 인증 및 설정 관리

### 8.1 바운디드 컨텍스트: `core.auth`, `core.config`

### 8.2 인증 전략

| 채널 | 인증 방식 |
|------|----------|
| Web UI | JWT (로그인/회원가입) |
| CLI | API Key |
| Telegram | Bot Token + 허용 user_id |
| Discord | Bot Token + 허용 서버/채널 |
| MCP 연동 | OAuth2 (Google, Notion 등) |

### 8.3 도메인 모델

| 개념 | 역할 | 타입 |
|------|------|------|
| `User` | 사용자 (채널 연결 정보 포함) | 애그리게이트 루트 |
| `Credential` | 채널별 인증 정보 | 값 객체 |
| `AppConfig` | 환경별 설정 (불변) | 값 객체 |
| `SecretStore` | API 키/토큰 암호화 저장 | 리포지토리 |

### 8.4 데이터 소유권 (개인 주권)

```python
class UserDataPolicy(Protocol):
    async def export_all(self, user_id: str) -> DataArchive: ...
    async def delete_all(self, user_id: str) -> None: ...
    async def audit_log(self, user_id: str) -> list[DomainEvent]: ...
```

---

## 9. 바운디드 컨텍스트 맵

```
        Upstream                          Downstream
┌─────────────┐  MessageReceived   ┌──────────────┐
│   Gateway   │ ──────────────────►│    Core      │
│  (채널 입력)  │                     │ (LLM/이벤트)  │
└─────────────┘                     └──────┬───────┘
                                           │
                    ActionRequired         │  ResponseGenerated
              ┌────────────────────────────┤
              ▼                            ▼
┌──────────────┐                   ┌─────────────┐
│ Integration  │                   │   Gateway   │
│ (액션 실행)   │                   │  (응답 전달)  │
└──────────────┘                   └─────────────┘
              │
              │  PatternDetected / ConversationStored
              ▼
┌──────────────┐                   ┌──────────────┐
│  Automation  │◄─ EventStream ───│   Memory     │
│ (자동화 엔진) │                   │  (기억/학습)  │
└──────────────┘                   └──────────────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │  Knowledge   │
                                   │  (지식베이스)  │
                                   └──────────────┘

관계 유형:
- Gateway → Core: Open Host Service (OHS)
- Core → Integration: Published Language (PL)
- Core → Automation/Memory: Event Stream (비동기)
- Integration → 외부 서비스: Anti-Corruption Layer (ACL)
```

---

## 10. CI/CD 파이프라인

```yaml
# .github/workflows/ci.yml
trigger: push, pull_request

jobs:
  lint:     ruff check + mypy
  test:     pytest (unit → integration)
  build:    docker build
  deploy:   docker-compose up (staging)
```

---

## 11. 에러 처리 전략

### 11.1 에러 분류

```python
class AlmaError:
    code: str
    message: str
    severity: str          # "transient", "permanent", "critical"
    retry_after: float | None

class TransientError(AlmaError):
    """재시도 가능: 네트워크 타임아웃, 레이트 리밋, 일시적 장애"""
    pass

class PermanentError(AlmaError):
    """재시도 불가: 인증 실패, 잘못된 요청, 리소스 없음"""
    pass

class CriticalError(AlmaError):
    """시스템 장애: DB 연결 실패, 이벤트 스토어 장애"""
    pass
```

### 11.2 재시도 / 서킷 브레이커 정책

| 모듈 | 재시도 | 서킷 브레이커 |
|------|--------|-------------|
| LLM Provider | 최대 3회, 지수 백오프 | 연속 5회 실패 → OPEN (60초) |
| Integration | 최대 2회, 1초 간격 | 연속 3회 실패 → OPEN (30초) |
| EventStore | 최대 3회, 즉시 재시도 | 실패 시 CRITICAL 알림 |
| Gateway | 재시도 없음 (사용자에게 에러 반환) | N/A |

---

## 12. 관측성 (Observability)

### 12.1 구조적 로깅

```python
# 모든 로그에 포함되는 공통 필드
{
    "timestamp": "2026-03-17T12:00:00Z",
    "level": "INFO",
    "module": "core.llm",
    "trace_id": "abc-123",
    "user_id": "user-456",
    "message": "Completion request routed",
    "data": {"provider": "claude", "latency_ms": 1200}
}
```

### 12.2 핵심 메트릭

| 메트릭 | 설명 |
|--------|------|
| `llm_request_duration_ms` | LLM 요청 응답 시간 |
| `llm_tokens_total` | 모델별/사용자별 토큰 사용량 |
| `llm_cost_usd` | 모델별 비용 추적 |
| `event_processing_lag_ms` | 이벤트 발행 → 처리 지연 시간 |
| `channel_messages_total` | 채널별 메시지 수 |
| `integration_action_duration_ms` | 외부 서비스 액션 실행 시간 |
| `error_rate` | 모듈별 에러 비율 |

### 12.3 헬스 체크

```
GET /health → 전체 시스템 상태
{
    "status": "healthy",
    "components": {
        "database": "healthy",
        "event_bus": "healthy",
        "llm_providers": {"claude": "healthy", "openai": "degraded"},
        "integrations": {"calendar": "healthy", "notion": "healthy"}
    }
}
```

### 12.4 추적 (Tracing)

- OpenTelemetry 통합
- 모든 `DomainEvent`에 `trace_id` 포함
- 사용자 메시지 → LLM 처리 → 액션 실행까지 전체 체인 추적

---

## 13. 레이트 리밋 및 비용 관리

### 13.1 사용자별 토큰 예산

| 항목 | 기본값 | 설정 가능 |
|------|--------|----------|
| 일일 토큰 한도 | 100,000 | ✅ |
| 시간당 요청 한도 | 60 | ✅ |
| 비용 알림 임계값 | $5/일 | ✅ |
| 자동 차단 임계값 | $10/일 | ✅ |

### 13.2 비용 추적

```python
class CostTracker:
    async def record_usage(self, user_id: str, provider: str,
                           input_tokens: int, output_tokens: int) -> None: ...
    async def check_budget(self, user_id: str) -> BudgetStatus: ...
    async def get_daily_cost(self, user_id: str) -> float: ...
```

---

## 14. 비용 상세 (Phase 2 기준)

| 항목 | 월 예상 비용 |
|------|-------------|
| PostgreSQL (Supabase Free → Pro) | $0~25 |
| Redis (Upstash Free Tier) | $0~10 |
| LLM API (예: Claude Sonnet 기준) | $10~50 (사용량 의존) |
| 도메인/SSL | $0~5 |
| **합계** | **$10~90/월** |

---

## 15. 성장 엔진 (Sub-5 Growth)

### 15.1 바운디드 컨텍스트: `growth`

### 15.2 도메인 모델

| 개념 | 역할 | 타입 |
|------|------|------|
| `Goal` | 사용자의 삶의 목표 | 애그리게이트 루트 |
| `Milestone` | 목표 달성의 중간 체크포인트 | 엔티티 |
| `Reflection` | 목표 대비 진행 회고 기록 | 값 객체 |
| `Insight` | 사용자 데이터에서 발견한 성장 인사이트 | 값 객체 |
| `GrowthLoop` | 목표→행동→회고→조정 사이클 | 도메인 서비스 |
| `AgentMaturity` | ALMA 자체 학습 수준 추적 | 엔티티 |

### 15.3 애그리게이트: Goal

**애그리게이트 루트**: `Goal`
**불변식**:
- 목표는 반드시 측정 가능한 기준(success_criteria)을 가져야 한다
- 마일스톤은 시간순으로 정렬되어야 한다
- 완료된 목표는 수정할 수 없다 (회고만 추가 가능)

**발행 이벤트**: `GoalCreated`, `MilestoneReached`, `ReflectionAdded`, `InsightGenerated`, `GoalCompleted`

### 15.4 Spec: 핵심 인터페이스

```python
@dataclass
class Goal:
    id: str
    user_id: str
    title: str
    description: str
    category: str              # career, health, learning, finance, relationship
    success_criteria: list[str]
    milestones: list[Milestone]
    status: str                # active, paused, completed, abandoned
    target_date: datetime | None
    created_at: datetime

@dataclass
class Milestone:
    id: str
    title: str
    is_completed: bool
    completed_at: datetime | None
    evidence: str | None       # 달성 근거

@dataclass(frozen=True)
class Reflection:
    goal_id: str
    content: str
    progress_score: float      # 0.0 ~ 1.0
    blockers: list[str]
    next_actions: list[str]
    created_at: datetime

@dataclass(frozen=True)
class Insight:
    user_id: str
    insight_type: str          # pattern, suggestion, warning, celebration
    content: str
    source_events: list[str]   # 인사이트 도출 근거 이벤트 ID
    confidence: float
    created_at: datetime

@dataclass
class AgentMaturity:
    user_id: str
    understanding_score: float  # 사용자 이해도 (0.0 ~ 1.0)
    automation_accuracy: float  # 자동화 정확도
    knowledge_coverage: float   # 지식 커버리지
    total_interactions: int
    level: str                  # beginner, intermediate, advanced, expert
```

### 15.5 성장 루프 (Growth Loop)

```
┌─────────────────────────────────────────┐
│           Growth Loop Cycle              │
│                                          │
│  1. 목표 설정 (Goal)                     │
│     └─ 사용자가 목표 정의 + 마일스톤 설정  │
│                                          │
│  2. 행동 추적 (Track)                    │
│     └─ 이벤트 스트림에서 목표 관련 행동 감지│
│     └─ 자동화 엔진과 연동                 │
│                                          │
│  3. 회고 (Reflect)                       │
│     └─ 주기적 회고 프롬프트 (주간/월간)    │
│     └─ 진행률 자동 계산                   │
│                                          │
│  4. 인사이트 (Insight)                   │
│     └─ 패턴 감지: "매주 월요일에 운동 빠짐" │
│     └─ 제안: "화요일로 변경하면 어떨까요?"  │
│     └─ 축하: "3주 연속 목표 달성!"        │
│                                          │
│  5. 조정 (Adjust)                        │
│     └─ 목표/마일스톤 수정 제안            │
│     └─ 새로운 자동화 규칙 생성            │
│                                          │
│  → 1로 돌아감 (지속적 성장 사이클)        │
└─────────────────────────────────────────┘
```

### 15.6 ALMA 자체 성장 (Agent Maturity)

| 레벨 | 조건 | 능력 |
|------|------|------|
| Beginner | 0~50 대화 | 기본 응답, 수동 설정 |
| Intermediate | 50~200 대화 | 선호도 학습, 기본 자동화 제안 |
| Advanced | 200~1000 대화 | 정확한 자동화, 사전 예측 제안 |
| Expert | 1000+ 대화 | 복합 자동화, 삶의 패턴 인사이트 |

---

## 16. 자율성 설계 (Autonomy)

### 16.1 자율성 수준 모델

| 수준 | 설명 | 예시 |
|------|------|------|
| L0 수동 | 사용자 명시 요청에만 응답 | "일정 잡아줘" |
| L1 제안 | ALMA가 제안, 사용자 승인 후 실행 | "내일 회의 전에 자료 정리할까요?" |
| L2 자동+알림 | 자동 실행 후 사용자에게 알림 | "회의 노트를 자동 생성했습니다" |
| L3 완전 자율 | 사용자 개입 없이 자동 실행 | 반복 패턴 감지 → 자동 규칙 적용 |

### 16.2 자율성 제어 인터페이스

```python
@dataclass
class AutonomyPolicy:
    user_id: str
    default_level: int = 1                    # L1 제안이 기본
    domain_overrides: dict[str, int] = field(  # 도메인별 자율성 수준
        default_factory=lambda: {
            "calendar": 2,     # 일정은 자동 실행 + 알림
            "notification": 2, # 알림은 자동
            "finance": 0,      # 금융은 수동만
            "communication": 1 # 소통은 제안 후 승인
        }
    )
    require_confirmation_above_cost: float = 0.0  # $ 이상 비용 발생 시 확인
    quiet_hours: tuple[int, int] = (23, 7)        # 방해 금지 시간

class AutonomyGate:
    """모든 자율 행동 전 통과해야 하는 게이트"""
    async def check(self, action: ActionRequest,
                    policy: AutonomyPolicy) -> AutonomyDecision: ...
    # 반환: EXECUTE, ASK_PERMISSION, BLOCK
```

### 16.3 자율 행동 흐름

```
자동화 엔진 → ActionRequired 이벤트
    │
    ▼
AutonomyGate.check(action, user_policy)
    │
    ├─ EXECUTE → Integration 실행 → 알림 (L2+)
    ├─ ASK_PERMISSION → Gateway → 사용자에게 질문 → 승인 시 실행
    └─ BLOCK → 로그만 기록
```

---

## 17. 보안 설계 (Security)

### 17.1 보안 원칙

| 원칙 | 설명 |
|------|------|
| 최소 권한 | 각 모듈은 필요한 최소한의 접근 권한만 보유 |
| 심층 방어 | 단일 보안 계층 실패 시에도 다른 계층이 보호 |
| 제로 트러스트 | 모듈 간 통신도 인증/인가 필요 |
| 데이터 암호화 | 전송 중(TLS) + 저장 시(AES-256) 모두 암호화 |
| 감사 추적 | 모든 접근과 변경을 이벤트 스토어에 기록 |

### 17.2 보안 계층

```
┌──────────────────────────────────────────┐
│ Layer 1: 네트워크 (TLS/HTTPS)            │
├──────────────────────────────────────────┤
│ Layer 2: 인증 (JWT + API Key + OAuth2)   │
├──────────────────────────────────────────┤
│ Layer 3: 인가 (RBAC + 자율성 정책)       │
├──────────────────────────────────────────┤
│ Layer 4: 입력 검증 (Pydantic 스키마)     │
├──────────────────────────────────────────┤
│ Layer 5: 데이터 암호화 (AES-256)         │
├──────────────────────────────────────────┤
│ Layer 6: 감사 추적 (Event Store)         │
└──────────────────────────────────────────┘
```

### 17.3 Spec: 보안 인터페이스

```python
class SecretStore(Protocol):
    """민감 데이터 암호화 저장"""
    async def store(self, key: str, value: str, user_id: str) -> None: ...
    async def retrieve(self, key: str, user_id: str) -> str: ...
    async def rotate(self, key: str, user_id: str) -> None: ...
    async def delete(self, key: str, user_id: str) -> None: ...

class InputValidator:
    """모든 외부 입력 검증"""
    def validate_message(self, raw: Any) -> UnifiedMessage: ...  # XSS/인젝션 방지
    def sanitize_llm_output(self, content: str) -> str: ...       # 프롬프트 인젝션 방지

class AccessControl:
    """역할 기반 접근 제어"""
    async def check_permission(self, user_id: str,
                                resource: str, action: str) -> bool: ...
    async def audit(self, user_id: str, resource: str,
                    action: str, result: str) -> None: ...
```

### 17.4 위협 모델 및 대응

| 위협 | 대응 |
|------|------|
| LLM 프롬프트 인젝션 | 입력 검증 + 출력 새니타이징 + 시스템 프롬프트 격리 |
| API 키 노출 | SecretStore 암호화 저장 + 환경변수 분리 + 키 로테이션 |
| 세션 하이재킹 | JWT 만료 시간 제한 + Refresh Token 로테이션 |
| 데이터 유출 | 저장 시 암호화 + 전송 시 TLS + GDPR 삭제 지원 |
| 과도한 API 사용 | 레이트 리밋 + 토큰 예산 + 이상 탐지 |
| 자율 행동 오작동 | AutonomyGate + 비용 임계값 + 되돌리기 지원 |
| MCP 연동 권한 남용 | OAuth2 스코프 최소화 + 액션별 권한 검증 |

### 17.5 데이터 분류

| 등급 | 예시 | 저장 방식 |
|------|------|----------|
| Public | 앱 설정, UI 텍스트 | 평문 |
| Internal | 대화 기록, 이벤트 로그 | DB 암호화 |
| Confidential | API 키, OAuth 토큰 | SecretStore (AES-256) |
| Restricted | 비밀번호, 금융 정보 | SecretStore + 접근 로그 필수 |

---

## 18. 성공 기준

| 항목 | 기준 |
|------|------|
| LLM 라우터 | 3개 이상 Provider 전환 동작 |
| 이벤트 버스 | 이벤트 발행/구독/리플레이 동작 |
| 게이트웨이 | 최소 2개 채널 (Web + 1) 동작 |
| Integration | Google Calendar 또는 Notion 1개 액션 동작 |
| 데이터 | PostgreSQL + pgvector 저장/검색 동작 |
| 인증 | JWT 기반 로그인 동작 |
| 성장 엔진 | 목표 생성/마일스톤 추적/회고 기록 동작 |
| 자율성 게이트 | L0~L2 자율성 수준별 정상 동작 |
| 보안 | 입력 검증, SecretStore 암호화, 감사 로그 동작 |
| CI | lint + test 자동 실행 |
| 테스트 커버리지 | >80% |
