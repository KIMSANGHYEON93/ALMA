# Phase 5 Chunk 1: Habit Tracker — CRUD + 체크인 + Streak

**Goal:** 습관 생성/관리, UI/채팅 체크인, 유연한 streak 계산이 동작하는 습관 트래커 MVP

**Architecture:** DDD habit 바운디드 컨텍스트. HabitService가 GoalService와 느슨한 연결 (goal_id FK, SET NULL). Streak 계산은 frequency_type별 스케줄 판정 기반.

**Tech Stack:** Python, FastAPI, SQLAlchemy, Next.js 14, React 18, Tailwind CSS

**Chunk 범위:** Chunk 1은 백엔드 CRUD + 체크인 + streak + 프론트엔드 UI. 채팅 연동(Chunk 2), 통계/시각화(Chunk 3)는 별도 spec.

---

## 전체 Phase 5 로드맵

| Chunk | 범위 | 의존성 |
|-------|------|--------|
| **1 (이 스펙)** | 습관 CRUD + 체크인 UI + streak | 없음 |
| 2 | 채팅 자연어 체크인 + 리마인더 + Calendar 연동 + 컨텍스트 주입 | Chunk 1 |
| 3 | 히트맵 + 트렌드 + 상관관계 + LLM 인사이트 + 회고 연동 | Chunk 1, 2 |

---

## 1. 데이터 모델

### 1.1 Habit (습관 정의)

```
habits 테이블
├── id: UUID PK
├── user_id: UUID FK(users, CASCADE)
├── goal_id: UUID FK(goals, SET NULL), nullable
├── title: str, NOT NULL
├── description: text, nullable
├── frequency_type: str — CHECK IN ('daily','specific_days','times_per_week','every_n_days')
├── frequency_value: JSONB, default {}
├── target_value: float, nullable — 수량 목표 (null이면 boolean)
├── target_unit: str, nullable — "잔", "분", "km"
├── status: str — CHECK IN ('active','paused','archived')
├── start_date: date, NOT NULL, default today() — every_n_days 기준점, paused→active 시 갱신
├── sort_order: int, default 0
├── created_at: datetime, server_default now()
└── updated_at: datetime, server_default now(), onupdate now()

인덱스:
├── idx_habits_user: (user_id, status)
```

### 1.2 HabitLog (체크인 기록)

```
habit_logs 테이블
├── id: UUID PK
├── habit_id: UUID FK(habits, CASCADE)
├── user_id: UUID FK(users, CASCADE) — 비정규화 (today summary 쿼리 성능)
├── log_date: date, NOT NULL
├── completed: bool, NOT NULL
├── value: float, nullable — 실제 수량
├── note: text, nullable — 짧은 메모
├── source: str — CHECK IN ('ui','chat')
├── created_at: datetime, server_default now()

제약:
├── UNIQUE(habit_id, log_date) — 하루 한 번 체크인
인덱스:
├── idx_habit_logs_habit_date: (habit_id, log_date)
├── idx_habit_logs_user_date: (user_id, log_date)
```

**user_id 일관성:** checkin 서비스 메서드에서 `habit.user_id == user_id` 검증 필수.

### 1.3 ORM 모델 (models/models.py에 추가)

```python
class Habit(Base):
    __tablename__ = "habits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    goal_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("goals.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    frequency_type: Mapped[str] = mapped_column(nullable=False)
    frequency_value: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    target_value: Mapped[float | None] = mapped_column(nullable=True)
    target_unit: Mapped[str | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(nullable=False, default="active")
    start_date = mapped_column(Date, nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    logs: Mapped[list["HabitLog"]] = relationship(
        back_populates="habit", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_habits_user", "user_id", "status"),
        CheckConstraint(
            "frequency_type IN ('daily','specific_days','times_per_week','every_n_days')",
            name="ck_habits_frequency_type",
        ),
        CheckConstraint(
            "status IN ('active','paused','archived')",
            name="ck_habits_status",
        ),
    )


class HabitLog(Base):
    __tablename__ = "habit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    habit_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("habits.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    log_date = mapped_column(Date, nullable=False)
    completed: Mapped[bool] = mapped_column(nullable=False)
    value: Mapped[float | None] = mapped_column(nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(nullable=False, default="ui")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    habit: Mapped["Habit"] = relationship(back_populates="logs")

    __table_args__ = (
        UniqueConstraint("habit_id", "log_date", name="uq_habit_log_date"),
        Index("idx_habit_logs_habit_date", "habit_id", "log_date"),
        Index("idx_habit_logs_user_date", "user_id", "log_date"),
        CheckConstraint(
            "source IN ('ui','chat')",
            name="ck_habit_logs_source",
        ),
    )
```

### 1.4 도메인 Enum

```python
# domain/habit/models.py

class FrequencyType(str, Enum):
    DAILY = "daily"
    SPECIFIC_DAYS = "specific_days"    # frequency_value: {"days": [0,2,4]} (월=0, 일=6)
    TIMES_PER_WEEK = "times_per_week"  # frequency_value: {"times": 3}
    EVERY_N_DAYS = "every_n_days"      # frequency_value: {"interval": 2}

class HabitStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"

class CheckinSource(str, Enum):
    UI = "ui"
    CHAT = "chat"
```

### 1.5 frequency_value 스키마 및 검증 규칙

| frequency_type | frequency_value 예시 | 의미 | 검증 규칙 |
|---------------|---------------------|------|-----------|
| `daily` | `{}` | 매일 | frequency_value는 `{}` 만 허용 |
| `specific_days` | `{"days": [0, 2, 4]}` | 월, 수, 금 (Python weekday) | days 필수, 각 원소 0-6, 비어있지 않음, 중복 없음 |
| `times_per_week` | `{"times": 3}` | 주 3회 (아무 요일) | times 필수, 1 <= times <= 7 |
| `every_n_days` | `{"interval": 2}` | 격일 | interval 필수, interval >= 1 |

**검증 위치:** API Pydantic 스키마에서 frequency_type과 frequency_value 교차 검증 (validator). HabitService.create_habit에서도 이중 검증.

---

## 2. DDD 바운디드 컨텍스트

```
domain/habit/
  __init__.py
  models.py          ← FrequencyType, HabitStatus, CheckinSource
  repository.py      ← HabitRepository, HabitLogRepository
  service.py         ← HabitService

api/habits.py        ← FastAPI 라우터 (7 엔드포인트)
```

### 2.1 HabitRepository

| 메서드 | 시그니처 | 설명 |
|--------|----------|------|
| create | `(user_id, title, **kwargs) → Habit` | 습관 생성 |
| get | `(habit_id) → Habit \| None` | 단건 조회 |
| list_by_user | `(user_id, status?) → list[Habit]` | 사용자별 목록 |
| update | `(habit) → Habit` | 업데이트 |
| delete | `(habit_id) → None` | 삭제 (logs CASCADE) |

### 2.2 HabitLogRepository

| 메서드 | 시그니처 | 설명 |
|--------|----------|------|
| upsert | `(habit_id, user_id, log_date, **kwargs) → HabitLog` | 체크인 (같은 날 → 업데이트) |
| get_by_date | `(habit_id, log_date) → HabitLog \| None` | 특정 날짜 조회 |
| list_by_habit | `(habit_id, start, end) → list[HabitLog]` | 기간별 로그 |
| list_by_user_date | `(user_id, date) → list[HabitLog]` | 특정 날짜 전체 체크인 |
| get_logs_for_streak | `(habit_id, before_date, limit) → list[HabitLog]` | streak 계산용 역순 조회 |

### 2.3 HabitService

| 메서드 | 설명 |
|--------|------|
| `create_habit(user_id, title, **kwargs)` | 습관 생성 (start_date 기본값 = today) |
| `get_habit(habit_id, user_id)` | 습관 조회 (소유권 검증) |
| `list_habits(user_id, status?)` | 목록 조회 |
| `update_habit(habit, **kwargs)` | 수정. status를 paused→active로 변경 시 start_date를 today로 갱신 |
| `delete_habit(habit_id)` | 삭제 |
| `checkin(habit_id, user_id, log_date, completed, value?, note?, source)` | 체크인 (upsert). habit.user_id == user_id 검증 필수 |
| `get_logs(habit_id, start?, end?)` | 기간 로그. start 기본값 30일 전, end 기본값 오늘 |
| `get_today_summary(user_id)` | 오늘 전체 습관 현황 |
| `get_streak(habit_id, as_of_date)` | streak 계산 |
| `is_scheduled(habit, date)` | 스케줄 판정 (@staticmethod) |

### 2.4 Streak 계산 로직

**주 시작 기준:** 월요일 (ISO 8601)

```
is_scheduled(habit, date) → bool:  (@staticmethod)
  daily         → always True
  specific_days → date.weekday() in frequency_value["days"]
  times_per_week→ always True (주간 카운트로 판정)
  every_n_days  → (date - habit.start_date).days % interval == 0

get_streak(habit_id, as_of_date) → int:
  times_per_week:
    현재 주(아직 종료 안 됨)는 판정 제외, 단 이미 times 달성 시에만 포함
    직전 완료 주부터 역순으로 주간 달성 횟수 >= frequency_value["times"] 확인
    미달 주 만나면 중단, 연속 달성 주 수 반환

  daily / specific_days / every_n_days:
    as_of_date부터 역순 탐색
    각 날짜에 대해:
      if not is_scheduled(habit, date): skip (streak 유지)
      if log exists and completed: streak += 1
      else: break
    return streak
```

**start_date 규칙:**
- 습관 생성 시 start_date = today (또는 사용자 지정)
- paused → active 전환 시 start_date = today로 갱신 (every_n_days 기준점 리셋)
- every_n_days의 is_scheduled 판정에서 `habit.start_date` 사용 (datetime이 아닌 date 타입)

---

## 3. API 엔드포인트

**라우터 등록 순서:** `/today` → `/{id}` (경로 충돌 방지, goals.py의 /summary 패턴 참조)

### 3.1 습관 CRUD

| Method | Path | Request | Response |
|--------|------|---------|----------|
| POST | `/api/habits` | `{title, frequency_type, frequency_value, target_value?, target_unit?, goal_id?, description?, start_date?}` | `HabitResponse` |
| GET | `/api/habits?status=active` | query param | `list[HabitResponse]` |
| GET | `/api/habits/today` | — | `TodaySummary` |
| GET | `/api/habits/{id}` | — | `HabitDetailResponse (streak 포함)` |
| PUT | `/api/habits/{id}` | update fields (기존 goals 패턴과 동일) | `HabitResponse` |
| DELETE | `/api/habits/{id}` | — | 204 |

### 3.2 체크인

| Method | Path | Request | Response |
|--------|------|---------|----------|
| POST | `/api/habits/{id}/checkin` | `{log_date, completed, value?, note?}` | `HabitLogResponse` |
| GET | `/api/habits/{id}/logs?start=&end=` | query params (start 기본 30일 전, end 기본 오늘) | `list[HabitLogResponse]` |

### 3.3 Response 스키마

```python
# HabitResponse
{
  "id": "uuid",
  "title": "운동",
  "description": "매일 30분 이상",
  "frequency_type": "specific_days",
  "frequency_value": {"days": [0, 2, 4]},
  "target_value": 30,
  "target_unit": "분",
  "status": "active",
  "goal_id": "uuid or null",
  "start_date": "2026-03-01",
  "sort_order": 0,
  "created_at": "...",
  "updated_at": "..."
}

# HabitDetailResponse (HabitResponse + streak)
{
  ...HabitResponse,
  "streak": 5
}

# HabitLogResponse
{
  "id": "uuid",
  "habit_id": "uuid",
  "log_date": "2026-03-21",
  "completed": true,
  "value": 6,
  "note": "오늘은 6잔만",
  "source": "ui",
  "created_at": "..."
}

# TodaySummary (GET /api/habits/today)
{
  "date": "2026-03-21",
  "total": 5,
  "completed": 3,
  "habits": [
    {
      "id": "uuid",
      "title": "물 마시기",
      "frequency_type": "daily",
      "scheduled_today": true,
      "checked_in": true,
      "completed": true,
      "value": 6,
      "target_value": 8,
      "target_unit": "잔",
      "streak": 12,
      "note": "오늘은 6잔만"
    }
  ]
}
```

---

## 4. 프론트엔드

### 4.1 파일 구조

```
src/app/habits/page.tsx              ← /habits 메인 페이지
src/components/
  HabitCard.tsx                      ← 습관 카드 (체크인 + streak + 진행률)
  HabitForm.tsx                      ← 생성/수정 모달
  HabitTodaySummary.tsx              ← 오늘 요약 바
src/hooks/
  useHabits.ts                       ← 습관 API 훅
```

### 4.2 /habits 페이지 레이아웃

1. **상단 요약 바** (HabitTodaySummary) — "오늘 3/5 완료" + 프로그레스 바
2. **습관 카드 리스트** — 스케줄된 습관 우선 표시
   - Boolean 습관: 체크 버튼 클릭 → 즉시 체크인 (낙관적 업데이트). 재클릭 시 completed=false로 토글 해제
   - 수량 습관: 수량 입력 필드 + target 대비 프로그레스 바, target_value 이상 → 자동 completed
   - 메모: 펼침 영역
   - Streak: 🔥 N일 뱃지 (times_per_week는 N주)
   - 미체크인 습관은 강조 표시
3. **FAB (+)** — HabitForm 모달 (생성)
4. **카드 메뉴** — 수정, 일시정지, 삭제

### 4.3 NavBar 수정

수정 대상: `src/components/common/NavBar.tsx`

```
채팅 | 목표 | 습관 | 인사이트
```

### 4.4 middleware.ts 수정

`/habits` 경로를 인증 보호 대상에 추가.

### 4.5 lib/types.ts 수정

Habit, HabitLog, TodaySummary TypeScript 타입 추가.

---

## 5. 테스트

### tests/test_habit_service.py (15개)

| # | 테스트 | 검증 항목 |
|---|--------|-----------|
| 1 | `test_create_habit` | 생성 + DB 저장 + start_date 기본값 |
| 2 | `test_create_habit_with_goal` | goal_id 연결 |
| 3 | `test_list_habits_by_status` | status 필터 |
| 4 | `test_checkin_boolean` | completed=true 체크인 |
| 5 | `test_checkin_with_value` | value + note 체크인 |
| 6 | `test_checkin_upsert` | 같은 날 재체크인 → 업데이트 |
| 7 | `test_checkin_owner_validation` | 다른 사용자 습관 체크인 거부 |
| 8 | `test_streak_daily` | 매일 연속 달성 카운트 |
| 9 | `test_streak_specific_days` | 특정 요일만 카운트, 쉬는 날 스킵 |
| 10 | `test_streak_times_per_week` | 주 N회 연속 달성 주 카운트 |
| 11 | `test_streak_every_n_days` | interval 간격 연속 달성 카운트 |
| 12 | `test_streak_broken` | 누락 → streak 리셋 |
| 13 | `test_today_summary` | 스케줄된 습관 + 체크인 현황 |
| 14 | `test_is_scheduled_today` | frequency_type별 판정 (4가지 모두) |
| 15 | `test_delete_habit_cascades_logs` | CASCADE 삭제 |

---

## 6. Alembic 마이그레이션

- `habits` 테이블 + 인덱스 + CHECK 제약
- `habit_logs` 테이블 + UNIQUE + 인덱스 + CHECK 제약
- models/models.py에 Habit, HabitLog ORM 추가 (섹션 1.3 참조)

---

## 7. Chunk 1 제외 사항 (Chunk 2, 3)

| 기능 | Chunk |
|------|-------|
| 채팅 자연어 체크인 ("오늘 운동했어") | 2 |
| AI 리마인더 (대화 시작 시 미체크인 언급) | 2 |
| Google Calendar 리마인더 이벤트 | 2 |
| ChatService 습관 컨텍스트 주입 | 2 |
| 월간 캘린더 히트맵 | 3 |
| 주간/월간 트렌드 차트 | 3 |
| 습관 간 상관관계 분석 | 3 |
| LLM 기반 패턴 인사이트 | 3 |
| 회고에 습관 데이터 포함 | 3 |
