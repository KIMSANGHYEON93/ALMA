# Phase 4: 회고/인사이트 — 성장 분석 시스템 설계

> 대화와 목표 데이터를 분석하여 사용자의 성장 패턴을 발견하고 주기적 회고를 지원

## 1. 개요

### 목적
사용자의 대화 히스토리와 목표 진행 데이터를 LLM으로 분석하여 성장 인사이트를 자동 생성하고, 주기적 회고 프롬프트를 통해 자기 성찰을 지원하는 시스템.

### 스코프 (MVP)
- 주간 회고 수동 생성 (대화 + 목표 데이터 기반)
- 성장 인사이트 분석 (패턴 발견, 키워드 트렌드)
- 회고 히스토리 조회 + 인사이트 대시보드
- 프론트엔드 인사이트 탭 UI

### 스코프 외 (YAGNI)
- 월간/연간 회고 (Phase 5)
- 감정 분석 (Phase 5)
- AI 코칭 추천 (Phase 5)
- 대화 중 자동 회고 키워드 트리거 (Phase 5 — MVP에서는 수동 생성만)
- 외부 공유/내보내기 (N/A)

## 2. 도메인 모델 (DDD)

### Bounded Context: `insight` (신규)

```
domain/insight/
├── __init__.py
├── service.py          InsightService (회고 생성 + 인사이트 분석)
├── repository.py       RetrospectiveRepository, InsightRepository
└── models.py           InsightCategory 값 객체
```

### 컨텍스트 간 의존성 (Anti-Corruption Layer)
- `InsightService`는 `GoalService`의 공개 메서드(`list_goals`, `get_summary`)를 통해서만 목표 데이터 접근
- `GoalRepository` 직접 접근 금지 — 바운디드 컨텍스트 경계 준수
- 대화/메시지는 `MemoryService`의 기존 조회 메서드 활용

### ORM 모델 위치
기존 Shared Kernel 패턴을 따라 `models/models.py`에 추가.

### Entity: Retrospective (회고)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| period_type | str | weekly (MVP only) |
| period_start | date | 회고 기간 시작일 |
| period_end | date | 회고 기간 종료일 |
| summary | str (Text) | LLM이 생성한 회고 요약 |
| highlights | JSONB | 주요 성과 목록 |
| challenges | JSONB | 어려움/도전 목록 |
| goals_progress | JSONB | 기간 내 목표 진행 스냅샷 |
| conversation_count | int | 기간 내 대화 수 |
| message_count | int | 기간 내 메시지 수 |
| created_at | datetime | 생성일 |
| updated_at | datetime | 수정일 (onupdate=func.now()) |

### Entity: Insight (인사이트)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| retrospective_id | UUID? | FK → retrospectives (nullable, 독립 인사이트 가능) |
| category | str | topic_trend / goal_pattern / activity_pattern / recommendation |
| title | str | 인사이트 제목 |
| content | str (Text) | 인사이트 상세 내용 |
| data | JSONB | 분석 데이터 |
| source_period | str | 분석 기간 (예: "2026-W12") |
| created_at | datetime | 생성일 |

## 3. API 엔드포인트

### `api/insights.py` — Router prefix: `/api/insights`

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/insights/retrospectives` | 필수 | 주간 회고 생성 (body: {timezone?}) |
| GET | `/api/insights/retrospectives` | 필수 | 회고 히스토리 (최신 순) |
| GET | `/api/insights/retrospectives/{id}` | 필수 | 회고 상세 + 연결된 인사이트 |
| GET | `/api/insights/dashboard` | 필수 | 대시보드 (통계 + 최근 회고 + 인사이트) |

**API 네이밍:** 기존 `POST /api/goals` 패턴과 일관 — 동사(generate) 대신 자원(retrospectives) POST.

### 소유권 검증
모든 엔드포인트에서 `user_id == current_user.id` 검증.

## 4. InsightService 설계

### 토큰 비용 제어 전략

메시지 수집 시 **최대 50개 메시지** 샘플링 + 메시지 요약 (content 앞 200자 절단):
```python
MAX_MESSAGES = 50
MAX_CONTENT_LENGTH = 200

messages_summary = [
    f"[{m.role}] {m.content[:MAX_CONTENT_LENGTH]}"
    for m in messages[:MAX_MESSAGES]
]
```
예상 입력 토큰: ~4K-6K (50개 * 200자 * ~1.5 토큰/자)

### 타임존 처리

API에서 사용자 timezone을 받거나, `User.preferences.timezone`에서 읽음:
```python
async def generate_weekly_retrospective(self, user_id, timezone="Asia/Seoul"):
    tz = ZoneInfo(timezone)
    now = datetime.now(tz).date()
    period_end = now
    period_start = now - timedelta(days=7)
```

### JSON 파싱 안전 처리

```python
async def _analyze_with_llm(self, messages_summary, goals_snapshot):
    response = await self.llm.complete(request)
    try:
        return json.loads(response.content)
    except (json.JSONDecodeError, KeyError):
        # 폴백: 기본 구조 반환
        return {
            "summary": response.content[:500],
            "highlights": [],
            "challenges": [],
            "insights": [],
        }
```

### 빈 주 처리

메시지 0개일 경우 LLM 호출 없이 기본 템플릿 사용:
```python
if not messages:
    return await self.retro_repo.create(
        ..., summary="이번 주는 활동이 없었습니다. 다음 주에 다시 시작해보세요!",
        highlights=[], challenges=[], ...
    )
```

### 주간 회고 생성 프로세스

```python
class InsightService:
    def __init__(self, session, llm, goal_service):
        self.session = session
        self.llm = llm
        self.goal_service = goal_service  # Anti-Corruption: 공개 메서드만 사용
        self.retro_repo = RetrospectiveRepository(session)
        self.insight_repo = InsightRepository(session)

    async def generate_weekly_retrospective(self, user_id, timezone="Asia/Seoul"):
        # 1. 기간 설정 (타임존 반영)
        tz = ZoneInfo(timezone)
        now = datetime.now(tz).date()
        period_end = now
        period_start = now - timedelta(days=7)

        # 2. 중복 체크
        existing = await self.retro_repo.get_by_period(user_id, "weekly", period_start)
        if existing:
            return existing  # 이미 생성됨

        # 3. 데이터 수집 (기존 서비스 공개 메서드 사용)
        conversations = await self._get_period_conversations(user_id, period_start, period_end)
        messages = await self._get_period_messages(user_id, period_start, period_end)
        goals_summary = await self.goal_service.get_summary(user_id)

        # 4. 빈 주 처리
        if not messages:
            return await self._create_empty_retrospective(user_id, period_start, period_end)

        # 5. 메시지 샘플링 + LLM 분석
        messages_summary = self._summarize_messages(messages)
        analysis = await self._analyze_with_llm(messages_summary, goals_summary)

        # 6. Retrospective + Insights 저장
        retro = await self.retro_repo.create(...)
        for insight in analysis.get("insights", []):
            await self.insight_repo.create(..., retrospective_id=retro.id)

        return retro
```

### 대시보드 데이터 구조

```python
async def get_dashboard(self, user_id) -> dict:
    return {
        "latest_retrospective": await self.retro_repo.get_latest(user_id),
        "recent_insights": await self.insight_repo.list_recent(user_id, limit=5),
        "stats": {
            "total_conversations": await self._count_conversations(user_id),
            "total_messages": await self._count_messages(user_id),
            "active_goals": (await self.goal_service.get_summary(user_id))["active_goals"],
            "completed_goals": ...,
            "streak_days": await self._calculate_streak(user_id),
        },
    }
```

### Streak 계산 정의
"활동" = 해당 날짜에 메시지를 1개 이상 전송. 연속 일수는 오늘부터 역순으로 활동 있는 날 카운트.

## 5. 데이터 수집 쿼리

### 기간 내 대화 조회
기존 `idx_conversations_user(user_id, updated_at)` 인덱스 활용:
```sql
SELECT * FROM conversations
WHERE user_id = $1 AND updated_at >= $2 AND updated_at <= $3
ORDER BY updated_at DESC;
```

### 기간 내 메시지 조회 (2단계)
```sql
-- Step 1: 기간 내 대화 ID 수집
SELECT id FROM conversations WHERE user_id = $1 AND updated_at BETWEEN $2 AND $3;

-- Step 2: 해당 대화의 메시지 (샘플링)
SELECT role, content, created_at FROM messages
WHERE conversation_id = ANY($conversation_ids)
ORDER BY created_at DESC LIMIT 50;
```

### Streak 쿼리
```sql
SELECT DISTINCT DATE(m.created_at) as activity_date
FROM messages m JOIN conversations c ON m.conversation_id = c.id
WHERE c.user_id = $1 AND m.role = 'user'
ORDER BY activity_date DESC;
-- 연속 날짜 카운트 (Python에서 처리)
```

## 6. DB 테이블 (Alembic 마이그레이션)

```sql
CREATE TABLE retrospectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_type VARCHAR NOT NULL DEFAULT 'weekly'
        CHECK (period_type = 'weekly'),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    summary TEXT NOT NULL,
    highlights JSONB NOT NULL DEFAULT '[]',
    challenges JSONB NOT NULL DEFAULT '[]',
    goals_progress JSONB NOT NULL DEFAULT '[]',
    conversation_count INTEGER NOT NULL DEFAULT 0,
    message_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_retro_user ON retrospectives(user_id, period_end DESC);
CREATE UNIQUE INDEX idx_retro_unique_period ON retrospectives(user_id, period_type, period_start);

CREATE TABLE insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    retrospective_id UUID REFERENCES retrospectives(id) ON DELETE SET NULL,
    category VARCHAR NOT NULL
        CHECK (category IN ('topic_trend','goal_pattern','activity_pattern','recommendation')),
    title VARCHAR NOT NULL,
    content TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    source_period VARCHAR,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_insights_user ON insights(user_id, created_at DESC);
CREATE INDEX idx_insights_retro ON insights(retrospective_id);
```

## 7. 프론트엔드 설계

### NavBar 확장
```
대화 | 목표 | 인사이트 | 설정
```

### /insights 페이지 — 컴포넌트 구조

| 컴포넌트 | 역할 |
|----------|------|
| `app/insights/page.tsx` | 인사이트 메인 페이지 |
| `components/RetrospectiveCard.tsx` | 회고 카드 (요약, 성과, 도전) |
| `components/InsightCard.tsx` | 인사이트 카드 (카테고리 아이콘, 내용) |
| `components/StatsBar.tsx` | 통계 바 (대화수, 목표수, 연속일) |
| `hooks/useInsights.ts` | 인사이트 API 훅 (타입은 lib/types.ts) |

## 8. 테스트 전략

### LLM 모킹 패턴
기존 `test_chat.py`와 동일 — `MagicMock` + `AsyncMock`으로 LLM 응답 모킹:
```python
mock_llm = MagicMock()
mock_llm.complete = AsyncMock(return_value=MagicMock(
    content=json.dumps({"summary": "...", "highlights": [], ...})
))
```

| 테스트 파일 | 범위 |
|------------|------|
| test_insight_service.py | 회고 생성 + LLM 모킹 + 빈 주 처리 + JSON 폴백 |
| test_insight_api.py | API 엔드포인트 + 소유권 + 중복 방지 |
| test_dashboard.py | 대시보드 통계 + streak 계산 |

### 핵심 테스트 케이스
1. 주간 회고 생성 → 메시지 샘플링(≤50) → LLM 분석 → 저장
2. 같은 주 중복 회고 → 기존 회고 반환 (새로 생성 안 함)
3. 빈 주 → LLM 호출 없이 기본 템플릿 저장
4. LLM JSON 파싱 실패 → 폴백 구조로 저장
5. 대시보드 통계 (대화수, 목표수, streak)
6. 소유권 검증 (다른 사용자 → 404)
7. Insight → Retrospective FK 관계 검증
8. 기존 테스트 깨지지 않음

## 9. 성공 기준

- [ ] 주간 회고 생성 API (POST /api/insights/retrospectives)
- [ ] 회고 히스토리 + 상세 API (연결된 인사이트 포함)
- [ ] 대시보드 API (통계 + 최근 회고 + 인사이트 + streak)
- [ ] 토큰 비용 제어 (메시지 50개 샘플링 + 200자 절단)
- [ ] 타임존 처리 (API 파라미터 또는 User.preferences)
- [ ] JSON 파싱 폴백 + 빈 주 LLM 스킵
- [ ] 프론트엔드 /insights 페이지 + NavBar 탭
- [ ] Retrospective ↔ Insight FK 관계
- [ ] 8+ 테스트 통과
- [ ] 기존 테스트 깨지지 않음
