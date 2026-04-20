# Phase D: Agent Automation — 인사이트 기반 자율 행동 실행

## 1. 개요

Phase C의 인사이트를 기반으로 자동화 규칙을 설정하고, 에이전트가 자율적으로 행동을 실행한다. 기존 VIVARA 인프라(Google Calendar, 이벤트 버스, 알림)를 활용하여 최소한의 새 코드로 자율화를 구현한다.

**핵심:** Insight → ActionPlanner (LLM) → ActionExecutor → 기존 시스템

**범위:** 자동화 규칙 CRUD, ActionPlanner (LLM 기반), ActionExecutor (온톨로지/알림), API, 프론트엔드
**범위 외:** 외부 MCP 서버 연결 (별도 Phase), 실시간 스트리밍 실행

---

## 2. 아키텍처

```
[OntologyInsight] ── insight.created 이벤트
        |
        v
[AutomationMatcher] ← 활성 규칙과 인사이트 타입 매칭
        |
        v
[ActionPlanner] ← LLM이 인사이트 + 규칙 → 구체적 행동 계획
        |
        v
[ActionExecutor]
  ├── ontology: 노드/엣지 생성/수정 (OntologyService)
  ├── notification: 사용자 알림 생성
  └── suggest: 인사이트에 행동 제안 첨부
        |
        v
[ontology_automation_logs] → 실행 이력
```

---

## 3. 데이터 모델

### ontology_automations (규칙)

```python
class OntologyAutomation(Base):
    __tablename__ = "ontology_automations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(nullable=False)
    insight_type: Mapped[str] = mapped_column(nullable=False)
    action_type: Mapped[str] = mapped_column(nullable=False)
    config: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    auto_execute: Mapped[bool] = mapped_column(default=False, server_default="false")
    enabled: Mapped[bool] = mapped_column(default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        Index("idx_automations_user", "user_id"),
        CheckConstraint(
            "insight_type IN ('hub_node','isolated','strong_path','conflict','opportunity','trend')",
            name="ck_automations_insight_type",
        ),
        CheckConstraint(
            "action_type IN ('create_link','create_node','notification','suggest')",
            name="ck_automations_action_type",
        ),
    )
```

### ontology_automation_logs (실행 이력)

```python
class OntologyAutomationLog(Base):
    __tablename__ = "ontology_automation_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    automation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ontology_automations.id", ondelete="CASCADE"), nullable=False)
    insight_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("ontology_insights.id", ondelete="SET NULL"), nullable=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action_taken: Mapped[str] = mapped_column(Text, nullable=False)
    result: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    status: Mapped[str] = mapped_column(nullable=False, default="success")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        Index("idx_auto_logs_user", "user_id", "created_at"),
        CheckConstraint("status IN ('success','failed','pending_approval')", name="ck_auto_logs_status"),
    )
```

---

## 4. ActionPlanner + ActionExecutor

### ActionPlanner (LLM 기반)

인사이트 + 규칙 config → 구체적 실행 계획 생성

```python
class ActionPlanner:
    async def plan(self, insight, automation) -> dict:
        # LLM에게: "이 인사이트에 대해 {action_type} 행동을 계획하세요"
        # 반환: {"action": "create_link", "params": {"source": "...", "target": "...", "relation": "supports"}}
```

### ActionExecutor

```python
class ActionExecutor:
    async def execute(self, plan: dict, user_id) -> dict:
        action = plan["action"]
        if action == "create_link":
            # OntologyService.create_link()
        elif action == "create_node":
            # OntologyService.create_object()
        elif action == "notification":
            # 인사이트 기반 알림 생성
        elif action == "suggest":
            # 인사이트에 action_suggestion 업데이트
        return {"status": "success", "detail": "..."}
```

---

## 5. 기본 시드 규칙

사용자 가입 시 기본 자동화 규칙 생성:

```python
DEFAULT_AUTOMATIONS = [
    {"name": "고립 노드 알림", "insight_type": "isolated", "action_type": "suggest", "auto_execute": False},
    {"name": "상충 관계 알림", "insight_type": "conflict", "action_type": "notification", "auto_execute": False},
    {"name": "연결 기회 제안", "insight_type": "opportunity", "action_type": "suggest", "auto_execute": False},
]
```

---

## 6. API

| 엔드포인트 | 메서드 | 설명 |
|---|---|---|
| GET /api/ontology/automations | GET | 규칙 목록 |
| POST /api/ontology/automations | POST | 규칙 생성 |
| PATCH /api/ontology/automations/{id} | PATCH | 규칙 수정/토글 |
| DELETE /api/ontology/automations/{id} | DELETE | 규칙 삭제 |
| POST /api/ontology/automations/execute | POST | 인사이트 기반 수동 실행 |
| GET /api/ontology/automations/logs | GET | 실행 이력 |

---

## 7. 프론트엔드

### /ontology/automations

```
AutomationsPage
├── RuleList — 규칙 목록 (enable/disable 토글, 편집, 삭제)
├── CreateRule — 인사이트 타입 + 행동 타입 선택
├── AutomationLog — 최근 실행 이력
```

---

## 8. 파일 구조

### Backend — Create
- `domain/ontology/action_planner.py` — ActionPlanner
- `domain/ontology/action_executor.py` — ActionExecutor
- `api/ontology_automations.py` — REST API
- `tests/test_ontology_automations.py` — 테스트

### Backend — Modify
- `models/models.py` — +OntologyAutomation, +OntologyAutomationLog
- `domain/ontology/repository.py` — +AutomationRepository, +AutomationLogRepository
- `main.py` — +automations 라우터

### Frontend — Create
- `app/ontology/automations/page.tsx`
- `components/ontology/AutomationCard.tsx`
- `hooks/useOntologyAutomations.ts`

### Frontend — Modify
- `app/ontology/page.tsx` — +Automations 버튼
- `lib/types.ts` — +OntologyAutomation, OntologyAutomationLog 타입
