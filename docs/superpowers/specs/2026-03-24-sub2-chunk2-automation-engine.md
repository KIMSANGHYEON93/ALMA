# Sub-2 Chunk 2: Automation Engine — 패턴 감지 + 규칙 CRUD

## 1. 개요

이벤트 스토어의 이벤트 시퀀스에서 반복 패턴을 감지하고, 자동화 규칙을 생성/관리/실행한다.

**범위:**
- automation_rules 테이블 + ORM
- AutomationRule 도메인 모델 + Repository + Service
- LLM 기반 패턴 감지 (이벤트 시퀀스 분석)
- 규칙 CRUD API (생성/조회/수정/삭제/활성화/비활성화)
- 규칙 자동 실행 (이벤트 트리거 → 액션)
- 채팅 인텐트 (automation.suggest, automation.list)
- 프론트엔드 관리 UI (/automations 페이지)

**범위 외:** 복잡한 조건 로직 (if/else 체인), 스케줄 기반 트리거 (cron), 외부 웹훅

---

## 2. 데이터 모델

### 2.1 automation_rules 테이블

비전 문서 섹션 7.4의 스키마:

```python
class AutomationRule(Base):
    __tablename__ = "automation_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    trigger_event: Mapped[str] = mapped_column(nullable=False)       # "habit.checkin_completed"
    trigger_condition: Mapped[dict] = mapped_column(JSONB, default=dict)  # {"completed": true}
    action_type: Mapped[str] = mapped_column(nullable=False)         # "chat.respond", "calendar.create_event"
    action_config: Mapped[dict] = mapped_column(JSONB, default=dict) # {"message": "잘했어요!"}
    confidence: Mapped[float] = mapped_column(default=0.0)
    is_active: Mapped[bool] = mapped_column(default=True)
    execution_count: Mapped[int] = mapped_column(default=0)
    last_executed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_rules_user", "user_id", "is_active"),
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="ck_rules_confidence"),
    )
```

### 2.2 trigger_condition 구조

이벤트의 payload와 매칭:
```json
{"completed": true}           // payload.completed == true 일 때
{"source": "chat"}            // payload.source == "chat" 일 때
{}                             // 조건 없음 (항상 매칭)
```

매칭 로직: `all(payload.get(k) == v for k, v in condition.items())`

### 2.3 action_type 종류 (초기)

| action_type | 설명 | action_config 예시 |
|------------|------|-------------------|
| `notification` | 사용자에게 알림 메시지 | `{"message": "운동 완료! 🎉"}` |
| `habit.checkin` | 다른 습관 자동 체크인 | `{"habit_title": "물 마시기"}` |
| `log` | 이벤트 로그만 기록 | `{"log_message": "패턴 감지됨"}` |

---

## 3. AutomationService

### 3.1 구조

```python
class AutomationService:
    def __init__(self, session, llm=None):
        self.rule_repo = AutomationRuleRepository(session)
        self.event_store = EventStoreRepository(session)
        self.llm = llm
```

### 3.2 CRUD

```python
async def create_rule(self, user_id, name, trigger_event, action_type, action_config,
                      trigger_condition=None, description=None) -> AutomationRule
async def get_rule(self, rule_id, user_id) -> AutomationRule | None
async def list_rules(self, user_id, active_only=True) -> list[AutomationRule]
async def update_rule(self, rule, **kwargs) -> AutomationRule
async def delete_rule(self, rule_id) -> None
async def toggle_rule(self, rule_id, user_id, is_active: bool) -> AutomationRule
```

### 3.3 이벤트 트리거 실행

이벤트 버스 핸들러로 등록 — 모든 이벤트 수신 → 매칭 규칙 실행:

```python
async def handle_event(self, event: DomainEvent) -> None:
    """이벤트 수신 → 매칭 규칙 찾기 → 실행"""
    if not event.user_id:
        return
    rules = await self.rule_repo.find_matching(
        uuid.UUID(event.user_id), event.event_type
    )
    for rule in rules:
        if self._matches_condition(event.payload, rule.trigger_condition):
            await self._execute_rule(rule, event)
```

```python
def _matches_condition(self, payload: dict, condition: dict) -> bool:
    return all(payload.get(k) == v for k, v in condition.items())
```

```python
async def _execute_rule(self, rule: AutomationRule, event: DomainEvent) -> None:
    """규칙 실행 + 실행 카운트 업데이트"""
    try:
        if rule.action_type == "notification":
            # 알림 이벤트 발행
            await emit("automation.notification", "automation",
                       {"message": rule.action_config.get("message", ""), "rule_id": str(rule.id)},
                       user_id=event.user_id)
        elif rule.action_type == "log":
            await emit("automation.logged", "automation",
                       {"log_message": rule.action_config.get("log_message", ""), "rule_id": str(rule.id)},
                       user_id=event.user_id)
        # 실행 카운트 업데이트
        await self.rule_repo.increment_execution(rule.id)
    except Exception:
        pass
```

### 3.4 LLM 패턴 감지

사용자의 최근 이벤트를 분석하여 자동화 제안:

```python
async def suggest_automations(self, user_id: uuid.UUID) -> list[dict]:
    """최근 7일 이벤트 분석 → 자동화 제안"""
    since = datetime.utcnow() - timedelta(days=7)
    events = await self.event_store.query_by_user(user_id, since, limit=50)
    if len(events) < 5:
        return []

    # 이벤트 시퀀스를 LLM에 전달
    event_summary = "\n".join(
        f"[{e.event_type}] {e.payload}" for e in events[:30]
    )
    prompt = f"""사용자의 최근 이벤트를 분석하여 자동화 규칙을 제안하세요.

이벤트 시퀀스:
{event_summary}

가능한 자동화 규칙:
- trigger_event: 이벤트 타입 (예: "habit.checkin_completed")
- trigger_condition: 조건 (예: {{"completed": true}})
- action_type: "notification" 또는 "log"
- action_config: 액션 설정 (예: {{"message": "잘했어요!"}})

JSON 배열로 최대 3개 제안:
[{{"name": "...", "trigger_event": "...", "trigger_condition": {{}}, "action_type": "...", "action_config": {{}}}}]"""

    response = await self.llm.complete(LLMRequest(...))
    # JSON 파싱
    return parsed_suggestions
```

---

## 4. API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `GET /api/automations` | list_rules | 규칙 목록 |
| `POST /api/automations` | create_rule | 규칙 생성 |
| `GET /api/automations/{id}` | get_rule | 규칙 상세 |
| `PUT /api/automations/{id}` | update_rule | 규칙 수정 |
| `DELETE /api/automations/{id}` | delete_rule | 규칙 삭제 |
| `PUT /api/automations/{id}/toggle` | toggle_rule | 활성/비활성 |
| `POST /api/automations/suggest` | suggest_automations | LLM 패턴 제안 |

### 4.1 Pydantic 스키마

```python
class RuleCreate(BaseModel):
    name: str = Field(min_length=1)
    trigger_event: str
    trigger_condition: dict = Field(default_factory=dict)
    action_type: Literal["notification", "habit.checkin", "log"]
    action_config: dict = Field(default_factory=dict)
    description: str | None = None

class RuleUpdate(BaseModel):
    name: str | None = None
    trigger_condition: dict | None = None
    action_config: dict | None = None
    description: str | None = None

class RuleResponse(BaseModel):
    id: str
    name: str
    description: str | None
    trigger_event: str
    trigger_condition: dict
    action_type: str
    action_config: dict
    confidence: float
    is_active: bool
    execution_count: int
    last_executed_at: str | None
    created_at: str
```

---

## 5. 채팅 인텐트

| 인텐트 | 실행 방식 | 설명 |
|--------|----------|------|
| `automation.suggest` | 자동 | "자동화 추천해줘" → LLM 패턴 분석 |
| `automation.list` | 자동 | "내 자동화 규칙 보여줘" → 규칙 목록 |
| `automation.create` | 확인 | "습관 완료하면 알림 보내줘" → 규칙 생성 |

---

## 6. 이벤트 버스 통합

main.py에서 앱 시작 시 AutomationService를 이벤트 핸들러로 등록:

```python
# AutomationService를 이벤트 핸들러로 등록
automation_handler = AutomationEventHandler(async_session)
event_bus.subscribe_all(automation_handler.handle)
```

`AutomationEventHandler`는 DB 세션을 생성하여 AutomationService에 위임:

```python
class AutomationEventHandler:
    def __init__(self, session_factory):
        self.session_factory = session_factory

    async def handle(self, event: DomainEvent) -> None:
        async with self.session_factory() as session:
            service = AutomationService(session)
            await service.handle_event(event)
```

---

## 7. 프론트엔드 — /automations 페이지

### 7.1 컴포넌트

| 컴포넌트 | 설명 |
|----------|------|
| `AutomationCard.tsx` | 규칙 카드 (이름, 트리거, 액션, 토글, 실행 횟수) |
| `AutomationForm.tsx` | 규칙 생성/수정 모달 |
| `useAutomations.ts` | API 훅 |

### 7.2 NavBar

"자동화" 탭 추가 + middleware /automations 보호

---

## 8. 파일 구조

### Backend — Create
| 파일 | 책임 |
|------|------|
| `domain/automation/__init__.py` | 패키지 |
| `domain/automation/service.py` | AutomationService (CRUD + 트리거 + 패턴 감지) |
| `domain/automation/repository.py` | AutomationRuleRepository |
| `domain/automation/handler.py` | AutomationEventHandler (이벤트 버스 핸들러) |
| `api/automations.py` | REST API 라우터 |
| `tests/test_automation.py` | 10개 테스트 |

### Backend — Modify
| 파일 | 변경 |
|------|------|
| `models/models.py` | +AutomationRule ORM |
| `main.py` | +AutomationEventHandler 등록, +automations_router |
| `domain/integration/service.py` | +automation.* 인텐트 |
| Alembic migration | +automation_rules 테이블 |

### Frontend — Create
| 파일 | 책임 |
|------|------|
| `app/automations/page.tsx` | 자동화 관리 페이지 |
| `components/AutomationCard.tsx` | 규칙 카드 |
| `components/AutomationForm.tsx` | 생성/수정 모달 |
| `hooks/useAutomations.ts` | API 훅 |

### Frontend — Modify
| 파일 | 변경 |
|------|------|
| `lib/types.ts` | +AutomationRule 타입 |
| `components/common/NavBar.tsx` | +자동화 탭 |
| `middleware.ts` | +/automations 보호 |

---

## 9. 테스트

| # | 테스트 | 내용 |
|---|--------|------|
| 1 | test_create_rule | 규칙 생성 + DB 저장 |
| 2 | test_list_rules | 사용자별 규칙 목록 |
| 3 | test_toggle_rule | 활성/비활성 토글 |
| 4 | test_delete_rule | 규칙 삭제 |
| 5 | test_match_condition | 조건 매칭 로직 |
| 6 | test_no_match_condition | 조건 불일치 시 실행 안 함 |
| 7 | test_handle_event_triggers_rule | 이벤트 → 매칭 규칙 실행 |
| 8 | test_inactive_rule_skipped | 비활성 규칙 스킵 |
| 9 | test_execution_count_increment | 실행 카운트 증가 |
| 10 | test_suggest_automations | LLM 모킹 → 제안 생성 |
