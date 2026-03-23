# Phase 5 Chunk 2: Habit Chat + Calendar Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 습관 트래커를 채팅 시스템(인텐트 기반 체크인/CRUD)과 Google Calendar(RRULE 반복 이벤트)에 연동

**Architecture:** 기존 IntegrationService 인텐트 감지 패턴에 `habit.*` 인텐트 추가. ChatService에 HabitService 주입 (GoalService 패턴 동일). HabitCalendarSync 서비스로 캘린더 동기화.

**Tech Stack:** Python 3.14, FastAPI WebSocket, SQLAlchemy 2.0 async, Google Calendar API, pytest-asyncio, Next.js 14

**Spec:** `docs/superpowers/specs/2026-03-23-phase5-chunk2-habit-chat-calendar.md`

---

## File Structure

### Backend — Create
| File | Responsibility |
|------|---------------|
| `backend/src/alma/domain/habit/calendar_sync.py` | HabitCalendarSync: RRULE 변환, 캘린더 이벤트 생성/삭제 |
| `backend/tests/test_habit_chat_integration.py` | 채팅-습관 통합 테스트 11개 |
| `backend/tests/test_habit_calendar_sync.py` | 캘린더 동기화 테스트 5개 |

### Backend — Modify
| File | Change |
|------|--------|
| `backend/src/alma/models/models.py` | Habit에 `calendar_event_id: str \| None` 추가 |
| `backend/src/alma/domain/habit/service.py` | +find_by_title, +get_habits_context |
| `backend/src/alma/domain/integration/service.py` | +habit_service 주입, detect_action_intent 프롬프트 확장, +_execute_habit_action |
| `backend/src/alma/domain/integration/calendar.py` | create_event에 recurrence/reminders, +delete_event |
| `backend/src/alma/domain/chat/service.py` | +habit_service 주입, 습관 컨텍스트 주입, +_execute_habit_intent |
| `backend/src/alma/api/chat.py` | +HabitService 주입, +접속 시 리마인더 |
| Alembic migration | +calendar_event_id 컬럼 |

### Frontend — Modify
| File | Change |
|------|--------|
| `frontend/src/hooks/useChatWebSocket.ts` | +habit_reminder 메시지 타입 처리 |
| `frontend/src/components/ChatWindow.tsx` | +habit_reminder 알림 배너 UI |

---

## Task 1: Habit 모델 변경 + HabitService 확장 + 마이그레이션

**Files:**
- Modify: `backend/src/alma/models/models.py`
- Modify: `backend/src/alma/domain/habit/service.py`
- Alembic migration

- [ ] **Step 1: Habit 모델에 calendar_event_id 추가**

`backend/src/alma/models/models.py`의 Habit 클래스, `sort_order` 뒤에 추가:

```python
    calendar_event_id: Mapped[str | None] = mapped_column(nullable=True)
```

- [ ] **Step 2: HabitService에 find_by_title 추가**

`backend/src/alma/domain/habit/service.py`의 `get_logs` 메서드 뒤에 추가:

```python
    async def find_by_title(self, user_id: uuid.UUID, query: str) -> list[Habit]:
        """활성 습관 중 title에 query가 포함된 습관 반환 (case-insensitive)"""
        habits = await self.list_habits(user_id, status="active")
        query_lower = query.lower()
        return [h for h in habits if query_lower in h.title.lower()]

    async def get_habits_context(self, user_id: uuid.UUID) -> str:
        """채팅 시스템 프롬프트에 주입할 오늘 습관 상태 텍스트"""
        summary = await self.get_today_summary(user_id)
        if summary["total"] == 0:
            return ""
        lines = [f"[오늘의 습관 ({summary['completed']}/{summary['total']} 완료)]"]
        for h in summary["habits"]:
            if not h["scheduled_today"]:
                continue
            icon = "✅" if h["completed"] else "⬜"
            text = f"- {icon} {h['title']}"
            if h["target_value"]:
                text += f" ({h['value'] or 0}/{h['target_value']}{h['target_unit'] or ''})"
            if h["streak"] > 0:
                text += f" 🔥{h['streak']}일"
            lines.append(text)
        return "\n".join(lines)
```

- [ ] **Step 3: Alembic 마이그레이션 생성 + 적용**

```bash
cd backend
source .venv/Scripts/activate && export $(grep -v '^#' .env | xargs)
alembic revision --autogenerate -m "add calendar_event_id to habits"
alembic upgrade head
```

- [ ] **Step 4: 커밋**

```bash
git add backend/src/alma/models/models.py backend/src/alma/domain/habit/service.py backend/alembic/versions/
git commit -m "feat: add calendar_event_id to Habit, find_by_title + get_habits_context"
```

---

## Task 2: IntegrationService habit 인텐트 확장

**Files:**
- Modify: `backend/src/alma/domain/integration/service.py`
- Test: `backend/tests/test_habit_chat_integration.py`

- [ ] **Step 1: 테스트 파일 생성 — find_by_title + 인텐트 감지 테스트**

```python
# backend/tests/test_habit_chat_integration.py
import uuid
from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from unittest.mock import AsyncMock

from alma.domain.habit.service import HabitService
from alma.domain.integration.service import ActionIntent, IntegrationService


@pytest.mark.asyncio
async def test_find_by_title_single_match(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    await service.create_habit(test_user.id, "운동하기", frequency_type="daily", frequency_value={}, start_date=date.today())
    await service.create_habit(test_user.id, "독서하기", frequency_type="daily", frequency_value={}, start_date=date.today())

    matches = await service.find_by_title(test_user.id, "운동")
    assert len(matches) == 1
    assert matches[0].title == "운동하기"


@pytest.mark.asyncio
async def test_find_by_title_multiple_matches(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    await service.create_habit(test_user.id, "물 마시기", frequency_type="daily", frequency_value={}, start_date=date.today())
    await service.create_habit(test_user.id, "커피 마시기", frequency_type="daily", frequency_value={}, start_date=date.today())

    matches = await service.find_by_title(test_user.id, "마시")
    assert len(matches) == 2


@pytest.mark.asyncio
async def test_find_by_title_no_match(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    await service.create_habit(test_user.id, "운동하기", frequency_type="daily", frequency_value={}, start_date=date.today())

    matches = await service.find_by_title(test_user.id, "없는습관")
    assert len(matches) == 0


@pytest.mark.asyncio
async def test_habits_context_injection(db_session: AsyncSession, test_user):
    service = HabitService(db_session)
    await service.create_habit(test_user.id, "운동", frequency_type="daily", frequency_value={}, start_date=date.today())

    ctx = await service.get_habits_context(test_user.id)
    assert "오늘의 습관" in ctx
    assert "운동" in ctx
    assert "⬜" in ctx  # 미완료
```

- [ ] **Step 2: 테스트 실행 — 통과 확인**

```bash
cd backend && source .venv/Scripts/activate && export $(grep -v '^#' .env | xargs)
cd C:/Users/sha2.kim/alma/backend && source .venv/Scripts/activate && export $(grep -v '^#' .env | xargs) && pytest tests/test_habit_chat_integration.py -v -k "find_by_title or habits_context"
```
Expected: 4 passed

- [ ] **Step 3: IntegrationService에 habit_service 주입 + 인텐트 프롬프트 확장**

`backend/src/alma/domain/integration/service.py` 수정:

```python
class IntegrationService:
    def __init__(self, session: AsyncSession, llm: LLMProvider, habit_service=None):
        self.session = session
        self.llm = llm
        self.action_log_repo = ActionLogRepository(session)
        self.integration_repo = IntegrationRepository(session)
        self.habit_service = habit_service
```

`detect_action_intent` 프롬프트 확장:

```python
    async def detect_action_intent(self, user_message: str) -> ActionIntent | None:
        prompt = (
            "Analyze if this message requires an external action.\n"
            "Available services and actions:\n"
            "- calendar.create_event: create calendar event\n"
            "- calendar.list_events: list calendar events\n"
            "- habit.checkin: check in a habit (params: title, completed=true, value?, note?)\n"
            "- habit.uncheckin: uncheck a habit (params: title)\n"
            "- habit.today: show today's habit summary (params: {})\n"
            "- habit.create: create a new habit (params: title, frequency_type, frequency_value, target_value?, target_unit?)\n"
            "- habit.update: update a habit (params: title, ...fields to change)\n"
            "- habit.delete: delete a habit (params: title)\n\n"
            "Rules:\n"
            "- habit.checkin, habit.uncheckin, habit.today → needs_confirmation=false\n"
            "- habit.create, habit.update, habit.delete → needs_confirmation=true\n"
            "- calendar actions → needs_confirmation=true\n\n"
            'If action needed, respond with JSON: {"service":"...","action":"...","params":{...},"needs_confirmation":true/false}\n'
            "If no action needed, respond with: null\n"
            "Message: " + user_message
        )

        request = LLMRequest(
            messages=[ChatMessage(role="user", content=prompt)],
            max_tokens=500,
            temperature=0.0,
        )
        response = await self.llm.complete(request)

        try:
            data = json.loads(response.content)
            if data is None:
                return None
            return ActionIntent(**data)
        except (json.JSONDecodeError, TypeError):
            return None
```

- [ ] **Step 4: _execute_habit_action 추가**

`execute_action` 메서드에 habit 분기 추가:

```python
    async def execute_action(self, user_id: str, intent: ActionIntent) -> dict:
        result: dict = {}
        success = True

        try:
            if intent.service == "calendar":
                result = await self._execute_calendar_action(user_id, intent)
            elif intent.service == "habit":
                result = await self._execute_habit_action(user_id, intent)
            elif intent.service == "notion":
                result = await self._execute_notion_action(user_id, intent)
            else:
                result = {"error": f"Unknown service: {intent.service}"}
                success = False
        except Exception as e:
            result = {"error": str(e)}
            success = False

        await self.action_log_repo.create(
            user_id=uuid.UUID(user_id),
            service=intent.service,
            action=intent.action,
            params=intent.params,
            result=result,
            success=success,
        )

        return result

    async def _execute_habit_action(self, user_id: str, intent: ActionIntent) -> dict:
        if not self.habit_service:
            return {"error": "Habit service not available"}

        uid = uuid.UUID(user_id)
        params = intent.params
        action = intent.action

        if action == "today":
            summary = await self.habit_service.get_today_summary(uid)
            return {"success": True, "summary": summary}

        title = params.get("title", "")
        matches = await self.habit_service.find_by_title(uid, title)

        if len(matches) == 0:
            return {"success": False, "error": f"'{title}' 습관을 찾을 수 없습니다"}
        if len(matches) > 1:
            return {"success": False, "error": "여러 습관이 일치합니다", "matches": [h.title for h in matches]}

        habit = matches[0]

        if action == "checkin":
            log = await self.habit_service.checkin(
                habit.id, uid, date.today(), completed=True, source="chat",
                value=params.get("value"), note=params.get("note"),
            )
            streak = await self.habit_service.get_streak(habit, date.today())
            return {"success": True, "habit": habit.title, "streak": streak}

        if action == "uncheckin":
            await self.habit_service.checkin(
                habit.id, uid, date.today(), completed=False, source="chat",
            )
            return {"success": True, "habit": habit.title, "unchecked": True}

        if action == "create":
            new_habit = await self.habit_service.create_habit(uid, **params)
            return {"success": True, "habit": new_habit.title, "created": True}

        if action == "update":
            changes = {k: v for k, v in params.items() if k != "title"}
            updated = await self.habit_service.update_habit(habit, **changes)
            return {"success": True, "habit": updated.title, "updated": True}

        if action == "delete":
            await self.habit_service.delete_habit(habit.id)
            return {"success": True, "habit": habit.title, "deleted": True}

        return {"success": False, "error": f"Unknown action: {action}"}
```

`_execute_habit_action`에 필요한 import 추가 (파일 상단):

```python
from datetime import date
```

- [ ] **Step 5: 인텐트 실행 테스트 추가**

`test_habit_chat_integration.py` 끝에 추가:

```python
@pytest.mark.asyncio
async def test_detect_habit_checkin_intent(db_session: AsyncSession):
    """LLM 응답에서 habit.checkin 인텐트 감지"""
    mock_llm = MagicMock()
    mock_llm.complete = AsyncMock(return_value=MagicMock(
        content='{"service":"habit","action":"checkin","params":{"title":"운동"},"needs_confirmation":false}'
    ))
    service = IntegrationService(db_session, mock_llm)
    intent = await service.detect_action_intent("운동 했어요라고 말씀하셨네요")
    assert intent is not None
    assert intent.service == "habit"
    assert intent.action == "checkin"
    assert intent.params["title"] == "운동"
    assert intent.needs_confirmation is False


@pytest.mark.asyncio
async def test_detect_habit_create_intent(db_session: AsyncSession):
    """LLM 응답에서 habit.create 인텐트 감지 (needs_confirmation=true)"""
    mock_llm = MagicMock()
    mock_llm.complete = AsyncMock(return_value=MagicMock(
        content='{"service":"habit","action":"create","params":{"title":"물 마시기","frequency_type":"daily","frequency_value":{}},"needs_confirmation":true}'
    ))
    service = IntegrationService(db_session, mock_llm)
    intent = await service.detect_action_intent("물 마시기 습관을 추가해드릴까요?")
    assert intent is not None
    assert intent.service == "habit"
    assert intent.action == "create"
    assert intent.needs_confirmation is True


@pytest.mark.asyncio
async def test_checkin_via_chat(db_session: AsyncSession, test_user):
    habit_service = HabitService(db_session)
    habit = await habit_service.create_habit(
        test_user.id, "운동하기", frequency_type="daily",
        frequency_value={}, start_date=date.today(),
    )

    mock_llm = MagicMock()
    integration_service = IntegrationService(db_session, mock_llm, habit_service=habit_service)

    intent = ActionIntent(service="habit", action="checkin", params={"title": "운동"}, needs_confirmation=False)
    result = await integration_service.execute_action(str(test_user.id), intent)

    assert result["success"] is True
    assert result["habit"] == "운동하기"
    assert "streak" in result

    # source가 "chat"인지 확인
    from alma.domain.habit.repository import HabitLogRepository
    log_repo = HabitLogRepository(db_session)
    log = await log_repo.get_by_date(habit.id, date.today())
    assert log is not None
    assert log.source == "chat"
    assert log.completed is True


@pytest.mark.asyncio
async def test_uncheckin_via_chat(db_session: AsyncSession, test_user):
    habit_service = HabitService(db_session)
    habit = await habit_service.create_habit(
        test_user.id, "운동하기", frequency_type="daily",
        frequency_value={}, start_date=date.today(),
    )
    # 먼저 체크인
    await habit_service.checkin(habit.id, test_user.id, date.today(), completed=True, source="ui")

    mock_llm = MagicMock()
    integration_service = IntegrationService(db_session, mock_llm, habit_service=habit_service)

    intent = ActionIntent(service="habit", action="uncheckin", params={"title": "운동"}, needs_confirmation=False)
    result = await integration_service.execute_action(str(test_user.id), intent)

    assert result["success"] is True
    assert result["unchecked"] is True


@pytest.mark.asyncio
async def test_create_habit_via_intent(db_session: AsyncSession, test_user):
    habit_service = HabitService(db_session)
    mock_llm = MagicMock()
    integration_service = IntegrationService(db_session, mock_llm, habit_service=habit_service)

    intent = ActionIntent(
        service="habit", action="create",
        params={"title": "물 마시기", "frequency_type": "daily", "frequency_value": {}, "start_date": str(date.today())},
        needs_confirmation=True,
    )
    result = await integration_service.execute_action(str(test_user.id), intent)

    assert result["success"] is True
    assert result["created"] is True

    habits = await habit_service.list_habits(test_user.id, status="active")
    assert any(h.title == "물 마시기" for h in habits)
```

- [ ] **Step 6: 전체 테스트 실행**

```bash
pytest tests/test_habit_chat_integration.py -v
```
Expected: 9 passed

- [ ] **Step 7: Ruff lint**

```bash
ruff check src/alma/domain/integration/service.py tests/test_habit_chat_integration.py
ruff format src/alma/domain/integration/service.py tests/test_habit_chat_integration.py
```

- [ ] **Step 8: 커밋**

```bash
git add backend/src/alma/domain/integration/service.py backend/tests/test_habit_chat_integration.py
git commit -m "feat: IntegrationService habit intent detection + execution (7 tests)"
```

---

## Task 3: ChatService 통합 — 습관 컨텍스트 + 자동 실행

**Files:**
- Modify: `backend/src/alma/domain/chat/service.py`
- Modify: `backend/src/alma/api/chat.py`
- Test: `backend/tests/test_habit_chat_integration.py` (+4 tests)

- [ ] **Step 1: ChatService에 habit_service 주입 + 습관 컨텍스트 주입 + 자동 실행**

`backend/src/alma/domain/chat/service.py` 수정:

import 추가 (파일 상단):
```python
from datetime import date
```

`__init__` 변경:
```python
class ChatService:
    def __init__(self, session: AsyncSession, llm: LLMProvider, goal_service=None, habit_service=None):
        self.session = session
        self.llm = llm
        embedding_provider = create_embedding_provider(settings)
        self.memory = MemoryService(session, embedding_provider)
        self.integration = IntegrationService(session, llm, habit_service=habit_service)
        self.profile = UserProfileService(session)
        self.goal_service = goal_service
        self.habit_service = habit_service
        self.conv_repo = ConversationRepository(session)
```

`process_message`에 습관 컨텍스트 주입 추가 (목표 컨텍스트 주입 뒤):
```python
        # 활성 습관 컨텍스트 주입 (optional)
        if self.habit_service:
            habit_context = await self.habit_service.get_habits_context(uuid.UUID(user_id))
            if habit_context:
                personalized_prompt += f"\n\n{habit_context}"
```

`process_message`에 자동 실행 인텐트 처리 추가 (인텐트 감지 후, 기존 action_note 로직 대체):
```python
        intent = await self.integration.detect_action_intent(response.content)
        action_note = ""
        if intent:
            if intent.needs_confirmation:
                action_note = (
                    f"\n\n---\n[Action: {intent.service}.{intent.action}"
                    f"({intent.params}). 실행할까요? (예/아니오)]"
                )
            else:
                # 자동 실행 (habit.checkin, habit.uncheckin, habit.today)
                result = await self.integration.execute_action(user_id, intent)
                action_note = self._format_habit_result(intent, result)
```

`_format_habit_result` 메서드 추가:
```python
    def _format_habit_result(self, intent: object, result: dict) -> str:
        """habit 인텐트 자동 실행 결과를 자연어로 포맷"""
        if not result.get("success"):
            return f"\n\n⚠️ {result.get('error', '실행 실패')}"

        action = getattr(intent, "action", "")
        if action == "checkin":
            streak = result.get("streak", 0)
            return f"\n\n✅ '{result['habit']}' 체크인 완료! 🔥{streak}일 연속"
        elif action == "uncheckin":
            return f"\n\n⬜ '{result['habit']}' 체크인이 취소되었습니다"
        elif action == "today":
            summary = result.get("summary", {})
            total = summary.get("total", 0)
            completed = summary.get("completed", 0)
            return f"\n\n📋 오늘 습관: {completed}/{total} 완료"
        return ""
```

- [ ] **Step 2: chat.py에 HabitService 주입 + 리마인더**

`backend/src/alma/api/chat.py` 수정:

import 추가:
```python
from alma.domain.habit.service import HabitService
```

WebSocket 핸들러에서 서비스 생성 부분 변경:
```python
    async with async_session() as session:
        llm = ClaudeProvider()
        goal_service = GoalService(session)
        habit_service = HabitService(session)
        chat_service = ChatService(
            session=session, llm=llm,
            goal_service=goal_service, habit_service=habit_service,
        )

        # 접속 시 미완료 습관 리마인더
        try:
            import uuid as uuid_mod
            summary = await habit_service.get_today_summary(uuid_mod.UUID(user_id))
            uncompleted = [
                h for h in summary["habits"]
                if h["scheduled_today"] and not h["completed"]
            ]
            if uncompleted:
                names = "\n".join(f"⬜ {h['title']}" for h in uncompleted)
                reminder_msg = (
                    f"오늘 아직 완료하지 않은 습관이 있어요:\n{names}\n"
                    f"완료: {summary['completed']}/{summary['total']}"
                )
                await websocket.send_text(json.dumps({
                    "type": "habit_reminder",
                    "message": reminder_msg,
                }))
        except Exception:
            logger.warning("Failed to send habit reminder", exc_info=True)

        try:
            while True:
                # ... 기존 메시지 루프
```

- [ ] **Step 3: 추가 테스트**

`test_habit_chat_integration.py`에 추가:

```python
@pytest.mark.asyncio
async def test_chat_with_habit_service(db_session: AsyncSession, test_user):
    """HabitService 주입 시 ChatService 생성 확인"""
    habit_service = HabitService(db_session)
    mock_llm = MagicMock()
    chat = ChatService(db_session, mock_llm, habit_service=habit_service)
    assert chat.habit_service is not None
    assert chat.integration.habit_service is not None


@pytest.mark.asyncio
async def test_chat_without_habit_service(db_session: AsyncSession):
    """habit_service=None이면 에러 없이 동작"""
    mock_llm = MagicMock()
    chat = ChatService(db_session, mock_llm, habit_service=None)
    assert chat.habit_service is None


@pytest.mark.asyncio
async def test_habit_today_via_intent(db_session: AsyncSession, test_user):
    habit_service = HabitService(db_session)
    await habit_service.create_habit(
        test_user.id, "운동", frequency_type="daily",
        frequency_value={}, start_date=date.today(),
    )

    mock_llm = MagicMock()
    integration_service = IntegrationService(db_session, mock_llm, habit_service=habit_service)

    intent = ActionIntent(service="habit", action="today", params={}, needs_confirmation=False)
    result = await integration_service.execute_action(str(test_user.id), intent)

    assert result["success"] is True
    assert "summary" in result
    assert result["summary"]["total"] == 1


@pytest.mark.asyncio
async def test_websocket_habit_reminder(db_session: AsyncSession, test_user):
    """접속 시 미완료 습관이 있으면 리마인더 생성 확인"""
    habit_service = HabitService(db_session)
    await habit_service.create_habit(
        test_user.id, "운동", frequency_type="daily",
        frequency_value={}, start_date=date.today(),
    )
    await habit_service.create_habit(
        test_user.id, "독서", frequency_type="daily",
        frequency_value={}, start_date=date.today(),
    )

    summary = await habit_service.get_today_summary(test_user.id)
    uncompleted = [h for h in summary["habits"] if h["scheduled_today"] and not h["completed"]]

    assert len(uncompleted) == 2
    assert any(h["title"] == "운동" for h in uncompleted)
```

- [ ] **Step 4: 전체 테스트**

```bash
pytest tests/test_habit_chat_integration.py -v
```
Expected: 13 passed

- [ ] **Step 5: Ruff + 커밋**

```bash
ruff check src/alma/domain/chat/service.py src/alma/api/chat.py tests/test_habit_chat_integration.py
ruff format src/alma/domain/chat/service.py src/alma/api/chat.py tests/test_habit_chat_integration.py
git add backend/src/alma/domain/chat/service.py backend/src/alma/api/chat.py backend/tests/test_habit_chat_integration.py
git commit -m "feat: ChatService habit integration — context injection, auto-execute, reminder (11 tests)"
```

---

## Task 4: GoogleCalendarProvider 확장 + HabitCalendarSync

**Files:**
- Modify: `backend/src/alma/domain/integration/calendar.py`
- Create: `backend/src/alma/domain/habit/calendar_sync.py`
- Create: `backend/tests/test_habit_calendar_sync.py`

- [ ] **Step 1: GoogleCalendarProvider에 recurrence/reminders 추가 + delete_event**

`backend/src/alma/domain/integration/calendar.py`의 `create_event` 수정:

```python
    async def create_event(
        self, summary: str, start: str, end: str,
        description: str | None = None,
        recurrence: list[str] | None = None,
        reminders: dict | None = None,
        timezone: str | None = None,
    ) -> CalendarEvent:
        await self._refresh_token_if_needed()
        creds = self._get_credentials()

        start_body: dict = {"dateTime": start}
        end_body: dict = {"dateTime": end}
        if timezone:
            start_body["timeZone"] = timezone
            end_body["timeZone"] = timezone

        event_body: dict = {
            "summary": summary,
            "start": start_body,
            "end": end_body,
        }
        if description:
            event_body["description"] = description
        if recurrence:
            event_body["recurrence"] = recurrence
        if reminders:
            event_body["reminders"] = reminders

        def _create():
            service = self._build_service(creds)
            return (
                service.events()
                .insert(calendarId="primary", body=event_body)
                .execute()
            )

        result = await asyncio.to_thread(_create)
        return self._parse_event(result)

    async def delete_event(self, event_id: str) -> None:
        """Google Calendar 이벤트 삭제"""
        await self._refresh_token_if_needed()
        creds = self._get_credentials()

        def _delete():
            service = self._build_service(creds)
            service.events().delete(calendarId="primary", eventId=event_id).execute()

        await asyncio.to_thread(_delete)
```

- [ ] **Step 2: HabitCalendarSync 생성**

```python
# backend/src/alma/domain/habit/calendar_sync.py
import uuid
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.integration.repository import IntegrationRepository
from alma.domain.integration.calendar import GoogleCalendarProvider
from alma.models.models import Habit

# weekday index → RRULE BYDAY
WEEKDAY_MAP = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]

# times_per_week → 균등 분배 요일
TIMES_TO_DAYS = {
    1: [0],           # MO
    2: [0, 3],        # MO,TH
    3: [0, 2, 4],     # MO,WE,FR
    4: [0, 1, 3, 4],  # MO,TU,TH,FR
    5: [0, 1, 2, 3, 4],     # MO-FR
    6: [0, 1, 2, 3, 4, 5],  # MO-SA
    7: [0, 1, 2, 3, 4, 5, 6],  # MO-SU
}


class HabitCalendarSync:
    def __init__(self, session: AsyncSession, integration_repo: IntegrationRepository):
        self.session = session
        self.integration_repo = integration_repo

    async def sync_to_calendar(
        self, habit: Habit, user_id: uuid.UUID,
        event_time: str = "09:00", timezone: str = "Asia/Seoul",
    ) -> str | None:
        """습관을 Google Calendar 반복 이벤트로 생성. event_id 반환.
        캘린더 미연동 시 None 반환."""
        integration = await self.integration_repo.get_active(user_id, "google_calendar")
        if not integration:
            return None

        provider = GoogleCalendarProvider(integration, self.integration_repo)
        rrule = self.frequency_to_rrule(habit.frequency_type, habit.frequency_value or {})

        from datetime import datetime as dt
        today_str = date.today().isoformat()
        start_dt = dt.strptime(f"{today_str}T{event_time}", "%Y-%m-%dT%H:%M")
        end_dt = start_dt + timedelta(minutes=30)
        start = start_dt.strftime("%Y-%m-%dT%H:%M:%S")
        end = end_dt.strftime("%Y-%m-%dT%H:%M:%S")

        event = await provider.create_event(
            summary=f"[습관] {habit.title}",
            start=start,
            end=end,
            timezone=timezone,
            recurrence=[rrule],
            reminders={
                "useDefault": False,
                "overrides": [{"method": "popup", "minutes": 30}],
            },
        )

        habit.calendar_event_id = event.id
        await self.session.commit()
        await self.session.refresh(habit)
        return event.id

    async def remove_from_calendar(self, habit: Habit, user_id: uuid.UUID) -> None:
        """습관의 캘린더 이벤트 삭제."""
        if not habit.calendar_event_id:
            return

        integration = await self.integration_repo.get_active(user_id, "google_calendar")
        if integration:
            provider = GoogleCalendarProvider(integration, self.integration_repo)
            try:
                await provider.delete_event(habit.calendar_event_id)
            except Exception:
                pass  # 이벤트가 이미 삭제된 경우

        # Integration 유무와 관계없이 고아 참조 제거
        habit.calendar_event_id = None
        await self.session.commit()

    @staticmethod
    def frequency_to_rrule(frequency_type: str, frequency_value: dict) -> str:
        """frequency_type/value → Google Calendar RRULE 문자열 변환"""
        if frequency_type == "daily":
            return "RRULE:FREQ=DAILY"

        if frequency_type == "specific_days":
            days = frequency_value.get("days", [])
            byday = ",".join(WEEKDAY_MAP[d] for d in sorted(days))
            return f"RRULE:FREQ=WEEKLY;BYDAY={byday}"

        if frequency_type == "times_per_week":
            times = frequency_value.get("times", 1)
            day_indices = TIMES_TO_DAYS.get(times, [0])
            byday = ",".join(WEEKDAY_MAP[d] for d in day_indices)
            return f"RRULE:FREQ=WEEKLY;BYDAY={byday}"

        if frequency_type == "every_n_days":
            interval = frequency_value.get("interval", 1)
            return f"RRULE:FREQ=DAILY;INTERVAL={interval}"

        return "RRULE:FREQ=DAILY"
```

- [ ] **Step 3: 캘린더 동기화 테스트**

```python
# backend/tests/test_habit_calendar_sync.py
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import date

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.habit.calendar_sync import HabitCalendarSync
from alma.domain.habit.service import HabitService
from alma.domain.integration.repository import IntegrationRepository


def test_frequency_to_rrule():
    assert HabitCalendarSync.frequency_to_rrule("daily", {}) == "RRULE:FREQ=DAILY"
    assert HabitCalendarSync.frequency_to_rrule("specific_days", {"days": [0, 2, 4]}) == "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"
    assert HabitCalendarSync.frequency_to_rrule("times_per_week", {"times": 3}) == "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"
    assert HabitCalendarSync.frequency_to_rrule("every_n_days", {"interval": 2}) == "RRULE:FREQ=DAILY;INTERVAL=2"
    assert HabitCalendarSync.frequency_to_rrule("specific_days", {"days": [1, 3, 5]}) == "RRULE:FREQ=WEEKLY;BYDAY=TU,TH,SA"
    assert HabitCalendarSync.frequency_to_rrule("times_per_week", {"times": 5}) == "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"


@pytest.mark.asyncio
async def test_sync_to_calendar(db_session: AsyncSession, test_user):
    habit_service = HabitService(db_session)
    habit = await habit_service.create_habit(
        test_user.id, "운동", frequency_type="daily",
        frequency_value={}, start_date=date.today(),
    )

    integration_repo = IntegrationRepository(db_session)
    sync = HabitCalendarSync(db_session, integration_repo)

    # Mock: Integration이 없으면 None 반환
    result = await sync.sync_to_calendar(habit, test_user.id)
    assert result is None
    assert habit.calendar_event_id is None


@pytest.mark.asyncio
async def test_remove_from_calendar_no_event(db_session: AsyncSession, test_user):
    habit_service = HabitService(db_session)
    habit = await habit_service.create_habit(
        test_user.id, "운동", frequency_type="daily",
        frequency_value={}, start_date=date.today(),
    )

    integration_repo = IntegrationRepository(db_session)
    sync = HabitCalendarSync(db_session, integration_repo)

    # calendar_event_id가 None이면 아무것도 안 함
    await sync.remove_from_calendar(habit, test_user.id)
    assert habit.calendar_event_id is None


@pytest.mark.asyncio
async def test_sync_without_integration(db_session: AsyncSession, test_user):
    """캘린더 미연동 시 None 반환 (graceful)"""
    habit_service = HabitService(db_session)
    habit = await habit_service.create_habit(
        test_user.id, "운동", frequency_type="specific_days",
        frequency_value={"days": [0, 2, 4]}, start_date=date.today(),
    )

    integration_repo = IntegrationRepository(db_session)
    sync = HabitCalendarSync(db_session, integration_repo)

    result = await sync.sync_to_calendar(habit, test_user.id)
    assert result is None


@pytest.mark.asyncio
async def test_delete_habit_calendar_cleanup(db_session: AsyncSession, test_user):
    """calendar_event_id가 있는 습관 삭제 시 캘린더 정리 확인"""
    habit_service = HabitService(db_session)
    habit = await habit_service.create_habit(
        test_user.id, "운동", frequency_type="daily",
        frequency_value={}, start_date=date.today(),
    )
    # calendar_event_id를 수동 설정
    habit.calendar_event_id = "mock_event_123"
    await db_session.commit()
    await db_session.refresh(habit)

    integration_repo = IntegrationRepository(db_session)
    sync = HabitCalendarSync(db_session, integration_repo)

    # Integration 없으면 캘린더 삭제 스킵하지만 calendar_event_id는 null로
    await sync.remove_from_calendar(habit, test_user.id)
    # Integration이 없으므로 provider.delete_event 호출 안 됨
    # 하지만 calendar_event_id는 None으로 설정됨
    assert habit.calendar_event_id is None
```

- [ ] **Step 4: 테스트 실행**

```bash
pytest tests/test_habit_calendar_sync.py -v
```
Expected: 5 passed

- [ ] **Step 5: Ruff + 커밋**

```bash
ruff check src/alma/domain/integration/calendar.py src/alma/domain/habit/calendar_sync.py tests/test_habit_calendar_sync.py
ruff format src/alma/domain/integration/calendar.py src/alma/domain/habit/calendar_sync.py tests/test_habit_calendar_sync.py
git add backend/src/alma/domain/integration/calendar.py backend/src/alma/domain/habit/calendar_sync.py backend/tests/test_habit_calendar_sync.py
git commit -m "feat: HabitCalendarSync + GoogleCalendarProvider recurrence/delete (5 tests)"
```

---

## Task 5: 프론트엔드 — WebSocket 리마인더 처리

**Files:**
- Modify: `frontend/src/hooks/useChatWebSocket.ts`
- Modify: `frontend/src/components/ChatWindow.tsx`

- [ ] **Step 1: useChatWebSocket에 habit_reminder 콜백 추가**

`frontend/src/hooks/useChatWebSocket.ts` 수정:

```typescript
import { useEffect, useRef, useState, useCallback } from "react";

export function useChatWebSocket(
  conversationId: string,
  token: string,
  onMessage: (content: string, id?: string) => void,
  onHabitReminder?: (message: string) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const onHabitReminderRef = useRef(onHabitReminder);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onHabitReminderRef.current = onHabitReminder;
  }, [onHabitReminder]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const ws = new WebSocket(
      `${protocol}//${host}/api/chat/ws/${conversationId}?token=${token}`
    );

    ws.onopen = () => { setIsConnected(true); setIsConnecting(false); };
    ws.onclose = () => { setIsConnected(false); setIsConnecting(false); };
    ws.onerror = (event) => {
      console.error("WebSocket 연결 오류:", event);
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "message") {
          onMessageRef.current(data.content, data.id);
        } else if (data.type === "habit_reminder") {
          const key = `habit_reminder_shown_${new Date().toISOString().split("T")[0]}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "true");
            onHabitReminderRef.current?.(data.message);
          }
        }
      } catch (error) {
        console.error("WebSocket 메시지 파싱 실패:", error);
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  }, [conversationId, token]);

  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ content }));
  }, []);

  return { isConnected, isConnecting, sendMessage };
}
```

- [ ] **Step 2: ChatWindow에 리마인더 배너 추가**

`frontend/src/components/ChatWindow.tsx`에서 useChatWebSocket 호출부를 찾아서 `onHabitReminder` 콜백을 추가하고, 알림 배너 state + UI를 추가한다.

먼저 ChatWindow.tsx를 읽어서 정확한 수정 위치를 확인한다. 대략적 변경:

```typescript
const [habitReminder, setHabitReminder] = useState<string | null>(null);

const { isConnected, isConnecting, sendMessage } = useChatWebSocket(
  conversationId, token, handleMessage,
  (message) => setHabitReminder(message)
);
```

알림 배너 JSX (채팅 메시지 영역 상단):

```tsx
{habitReminder && (
  <div className="mx-4 mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start justify-between">
    <div>
      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">습관 알림</p>
      <p className="text-sm text-amber-700 dark:text-amber-400 whitespace-pre-line mt-1">{habitReminder}</p>
    </div>
    <button
      onClick={() => setHabitReminder(null)}
      className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 ml-2"
    >
      ✕
    </button>
  </div>
)}
```

- [ ] **Step 3: TypeScript 타입 체크**

```bash
cd frontend && npx tsc --noEmit
```
Expected: 에러 0

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/hooks/useChatWebSocket.ts frontend/src/components/ChatWindow.tsx
git commit -m "feat: habit reminder banner on WebSocket connect"
```

---

## Task 6: 전체 테스트 + 빌드 검증 + 최종 커밋

- [ ] **Step 1: 백엔드 전체 테스트**

```bash
cd backend && source .venv/Scripts/activate && export $(grep -v '^#' .env | xargs)
pytest tests/ -v
```
Expected: 모든 기존 테스트 + 신규 18개 PASS (chat 13 + calendar 5)

- [ ] **Step 2: Ruff 전체 lint**

```bash
ruff check src/ tests/
```
Expected: All checks passed

- [ ] **Step 3: 프론트엔드 빌드**

```bash
cd frontend && npx tsc --noEmit && npx next build
```
Expected: 에러 0, 빌드 성공

- [ ] **Step 4: 최종 push**

```bash
git push origin feature/phase1-mvp
```
