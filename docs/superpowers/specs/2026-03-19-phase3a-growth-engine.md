# Phase 3A: Growth Engine — 성장 엔진 설계

> ALMA의 핵심 미션 "인간이 원하는 삶의 성장"을 실현하는 목표 관리 시스템

## 1. 개요

### 목적
사용자가 목표를 설정하고, 마일스톤으로 분해하며, 대화를 통해 자연스럽게 진행 상황을 추적하는 성장 관리 시스템.

### 스코프 (MVP)
- 목표(Goal) CRUD + 상태 관리
- 마일스톤(Milestone) CRUD + 완료 처리
- 대화 중 목표 관련 내용 자동 감지 → 목표 연결
- 목표 진행률 자동 계산
- 목표 대시보드 API
- 목표/마일스톤 DELETE 포함

### 스코프 외 (YAGNI)
- 회고/인사이트 자동 생성 (Phase 4)
- 습관 트래커 (Phase 4)
- 목표 추천 (Phase 4)
- 소셜 공유 (N/A)

## 2. 도메인 모델 (DDD)

### Bounded Context: `growth`

```
domain/growth/
├── __init__.py
├── service.py          GoalService (목표 관리 + 대화 연동)
├── repository.py       GoalRepository, MilestoneRepository
└── models.py           GoalStatus, GoalCategory 값 객체 (Enum)
```

### ORM 모델 위치
기존 Shared Kernel 패턴을 따라 `models/models.py`에 Goal, Milestone, GoalConversationLink SQLAlchemy 모델 추가.
`domain/growth/models.py`에는 GoalStatus, GoalCategory Enum 값 객체만 정의.

### Aggregate: Goal (Root)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| title | str | 목표 제목 (빈 문자열 불가, Pydantic 검증) |
| description | str? | 상세 설명 |
| category | GoalCategory (Enum) | personal / career / health / learning / finance / other |
| status | GoalStatus (Enum) | active / completed / paused / abandoned |
| target_date | date? | 목표 달성 기한 |
| progress | int | 0-100, 마일스톤 기반 자동 계산 (CHECK 0-100) |
| created_at | datetime | 생성일 |
| updated_at | datetime | 수정일 (onupdate=func.now()) |

### Entity: Milestone (within Goal aggregate)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| goal_id | UUID | FK → goals |
| title | str | 마일스톤 제목 |
| description | str? | 상세 설명 |
| status | str | pending / completed |
| sort_order | int | 정렬 순서 |
| completed_at | datetime? | 완료 시각 |
| created_at | datetime | 생성일 |
| updated_at | datetime | 수정일 (onupdate=func.now()) |

### Link Table: goal_conversation_links

| 필드 | 타입 | 설명 |
|------|------|------|
| goal_id | UUID | FK → goals |
| conversation_id | UUID | FK → conversations |
| relevance_note | str? | 연관 사유 |
| created_at | datetime | 연결 시각 |

**보안:** link 생성 시 `goal.user_id == conversation.user_id` 교차 검증 필수.

## 3. API 엔드포인트

### `api/goals.py` — Router prefix: `/api/goals`

**경로 등록 순서 주의:** `/api/goals/summary`를 `/{id}` 보다 먼저 등록해야 FastAPI 경로 충돌 방지.

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | `/api/goals/summary` | 필수 | 대시보드 요약 (활성 목표 수, 전체 진행률) |
| GET | `/api/goals` | 필수 | 사용자 목표 목록 (status 필터, category 필터) |
| POST | `/api/goals` | 필수 | 목표 생성 |
| GET | `/api/goals/{id}` | 필수 | 목표 상세 + 마일스톤 목록 |
| PUT | `/api/goals/{id}` | 필수 | 목표 수정 |
| DELETE | `/api/goals/{id}` | 필수 | 목표 삭제 (CASCADE로 마일스톤, 링크 함께 삭제) |
| PATCH | `/api/goals/{id}/status` | 필수 | 상태 변경 (completed, paused, abandoned) |
| POST | `/api/goals/{id}/milestones` | 필수 | 마일스톤 추가 |
| PUT | `/api/goals/{id}/milestones/{mid}` | 필수 | 마일스톤 수정 |
| DELETE | `/api/goals/{id}/milestones/{mid}` | 필수 | 마일스톤 삭제 → progress 재계산 |
| PATCH | `/api/goals/{id}/milestones/{mid}/complete` | 필수 | 마일스톤 완료 → progress 재계산 |

### 소유권 검증
모든 엔드포인트에서 `goal.user_id == current_user.id` 검증 (messages API 패턴 따름).

### Service 인스턴스화
API 라우터에서 `GoalService(session)`으로 생성 — ChatService 패턴과 동일.

## 4. ChatService 연동

### LLM 호출 통합 전략
**별도 LLM 호출 대신, 기존 IntegrationService 감지와 통합하여 1회 호출로 처리.**

기존 IntegrationService의 detect_action_intent 프롬프트를 확장:
```
Analyze this message for:
1. External action needs (calendar, notes)
2. Goal relevance (does it relate to user's active goals?)

Active goals: [goal list, max 5]

Respond with JSON:
{
  "action": {"service":"calendar|notion","action":"...","params":{...}} | null,
  "goal": {"goal_id":"...","relevance":"...","milestone_completed":null|"milestone_id"} | null
}
```

### ChatService 수정 (기존 테스트 호환 전략)
- `GoalService`를 `ChatService.__init__`에 **optional parameter** (default=None)로 추가
- goal_service가 None이면 목표 감지 스킵 → 기존 테스트 깨지지 않음
- 새 테스트에서만 GoalService를 주입하여 연동 테스트

### 컨텍스트 주입
- ChatService의 system prompt에 활성 목표 목록 포함 (최대 5개)
- "현재 목표: [목표1 (30%), 목표2 (70%)]" 형태로 LLM에 전달

## 5. 데이터 흐름

```
User: "오늘 운동 1시간 했어"
  → ChatService.process_message()
  → LLM: 응답 생성 (system prompt에 목표 컨텍스트 포함)
  → IntegrationService: 통합 감지 (action + goal relevance, 1회 LLM 호출)
  → GoalService: "건강 관리" 목표와 대화 연결
  → Response: "잘하셨어요! '건강 관리' 목표의 '주 3회 운동' 마일스톤 진행 중이네요."
```

### Progress 계산 로직
```python
def calculate_progress(milestones: list[Milestone]) -> int:
    if not milestones:  # division by zero 방어
        return 0
    completed = sum(1 for m in milestones if m.status == "completed")
    return min(100, int(completed / len(milestones) * 100))
```

### 모든 마일스톤 완료 시
progress가 100%가 되면 API 응답에 `"suggest_complete": true` 플래그 포함.
사용자가 PATCH /status로 명시적으로 완료 처리해야 함 (자동 완료 아님).

## 6. DB 테이블 (Alembic 마이그레이션)

```sql
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    description TEXT,
    category VARCHAR NOT NULL DEFAULT 'other'
        CHECK (category IN ('personal','career','health','learning','finance','other')),
    status VARCHAR NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','completed','paused','abandoned')),
    target_date DATE,
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_goals_user ON goals(user_id, status);

CREATE TABLE milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    description TEXT,
    status VARCHAR NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','completed')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_milestones_goal ON milestones(goal_id, sort_order);

CREATE TABLE goal_conversation_links (
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    relevance_note TEXT,
    created_at TIMESTAMP DEFAULT now(),
    PRIMARY KEY (goal_id, conversation_id)
);
```

## 7. 테스트 전략

| 테스트 파일 | 범위 |
|------------|------|
| test_goal_service.py | GoalService CRUD + progress 계산 + division by zero |
| test_goal_api.py | API 엔드포인트 + 소유권 검증 + DELETE |
| test_goal_chat_integration.py | ChatService 목표 감지 연동 (optional GoalService) |
| test_milestone.py | 마일스톤 CRUD + 완료 처리 + progress 재계산 |

### 핵심 테스트 케이스
1. 목표 생성 → 마일스톤 3개 추가 → 1개 완료 → progress 33%
2. 모든 마일스톤 완료 → progress 100% + `suggest_complete: true` 플래그
3. 마일스톤 0개 목표 → progress 0% (division by zero 방어)
4. 다른 사용자 목표 접근 → 404
5. 대화에서 목표 감지 → link 생성 (conversation 소유권 교차 검증)
6. 빈 문자열 title → 422 validation error
7. 잘못된 category/status 값 → 422 validation error
8. 목표 DELETE → 마일스톤, 링크 CASCADE 삭제
9. GoalService 미주입 시 기존 ChatService 동작 유지

## 8. 성공 기준

- [ ] 목표 CRUD + DELETE API 동작 (인증 + 소유권)
- [ ] 마일스톤 CRUD + DELETE + 자동 progress 계산
- [ ] category/status Enum 검증 (DB CHECK + Pydantic)
- [ ] ChatService에서 목표 컨텍스트 주입 (optional, 기존 테스트 유지)
- [ ] 통합 LLM 감지 (action + goal, 추가 LLM 호출 없음)
- [ ] 목표 감지 → conversation link 생성
- [ ] 10+ 테스트 통과
- [ ] 기존 27개 테스트 깨지지 않음
