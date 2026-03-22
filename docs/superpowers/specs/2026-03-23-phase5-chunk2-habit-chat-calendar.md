# Phase 5 Chunk 2: 습관 채팅 연동 + 캘린더 리마인더

## 1. 개요

Chunk 1에서 구현한 습관 트래커를 채팅 시스템과 Google Calendar에 연동한다.

**범위:**
- 채팅 기반 습관 체크인/조회/생성/수정/삭제 (인텐트 확장)
- WebSocket 접속 시 미완료 습관 리마인더
- Google Calendar 반복 이벤트 동기화 (RRULE)

**범위 외:** 통계/히트맵 (Chunk 3), 외부 알림 (push notification)

---

## 2. 인텐트 확장 — habit.* 인텐트

### 2.1 인텐트 타입

기존 `IntegrationService.detect_action_intent()` 시스템 프롬프트에 habit 인텐트를 추가한다. `detect_action_intent`는 **LLM 응답 텍스트**를 분석하여 인텐트를 추출한다 (사용자 메시지가 아님). LLM의 시스템 프롬프트에서 습관 관련 요청 시 적절한 액션 패턴을 생성하도록 유도한다.

| 인텐트 | 예시 발화 | 실행 방식 | 파라미터 |
|--------|----------|----------|---------|
| `habit.checkin` | "운동 했어", "물 6잔 마심" | 자동 | `{title, completed: true, value?, note?}` |
| `habit.uncheckin` | "운동 취소", "아 안했어" | 자동 | `{title}` |
| `habit.today` | "오늘 습관 어때?" | 자동 | `{}` |
| `habit.create` | "매일 물 8잔 습관 추가해줘" | 확인 필요 | `{title, frequency_type, frequency_value, target_value?, target_unit?}` |
| `habit.update` | "운동 주 5회로 바꿔줘" | 확인 필요 | `{title, ...changes}` |
| `habit.delete` | "운동 습관 삭제해줘" | 확인 필요 | `{title}` |

### 2.2 실행 방식

- **자동 실행** (checkin, uncheckin, today): 인텐트 감지 즉시 실행, 결과를 LLM 응답 뒤에 append
- **확인 필요** (create, update, delete): `needs_confirmation=true`로 사용자 승인 후 실행

### 2.3 습관 이름 매칭 (Fuzzy Match)

사용자가 정확한 습관 이름을 사용하지 않을 수 있으므로 `HabitService.find_by_title()` 추가:

- 활성 습관 목록에서 title 부분 일치 (case-insensitive, 포함 검색)
- 1개 매치 → 자동 선택
- 0개 매치 → LLM이 "해당 습관을 찾을 수 없습니다" 응답
- 2개+ 매치 → LLM이 목록 제시 후 선택 요청

```python
# domain/habit/service.py
async def find_by_title(self, user_id: uuid.UUID, query: str) -> list[Habit]:
    """활성 습관 중 title에 query가 포함된 습관 반환 (case-insensitive)"""
    habits = await self.list_habits(user_id, status="active")
    query_lower = query.lower()
    return [h for h in habits if query_lower in h.title.lower()]
```

### 2.4 채팅용 습관 컨텍스트

```python
# domain/habit/service.py
async def get_habits_context(self, user_id: uuid.UUID) -> str:
    """채팅 시스템 프롬프트에 주입할 오늘 습관 상태 텍스트.
    활성 습관이 없거나 오늘 스케줄된 습관이 없으면 빈 문자열 반환 (의도적: 비스케줄 날은 주입 불필요)."""
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

---

## 3. ChatService 통합

### 3.1 HabitService 주입

기존 GoalService 주입 패턴과 동일:

```python
class ChatService:
    def __init__(self, session, llm, goal_service=None, habit_service=None):
        ...
        self.habit_service = habit_service
```

### 3.2 process_message 흐름 변경 (의사코드)

**방식 A 채택**: LLM 응답 생성 후 인텐트 감지 → 자동 실행 → 결과를 응답 뒤에 append.

```python
async def process_message(self, user_id: str, conversation_id: str, content: str) -> str:
    # 1. (기존) 벡터 검색 → 히스토리
    # 2. (기존) 시스템 프롬프트 조립
    # 3. (추가) 습관 컨텍스트 주입
    if self.habit_service:
        habit_ctx = await self.habit_service.get_habits_context(uuid.UUID(user_id))
        if habit_ctx:
            system_prompt += f"\n\n{habit_ctx}"

    # 4. (기존) LLM 호출 → response_text
    # 5. (기존) detect_action_intent(response_text) → intent

    # 6. (추가) habit 인텐트 자동 실행
    if intent and intent.service == "habit" and not intent.needs_confirmation:
        result = await self._execute_habit_intent(user_id, intent)
        if result:
            response_text += f"\n\n{result}"

    # 7. (기존) 메시지 저장 + 반환
    return response_text
```

### 3.3 _execute_habit_intent 메서드

**title → habit 객체 변환 + 소유권 검증 포함:**

```python
async def _execute_habit_intent(self, user_id: str, intent: ActionIntent) -> str | None:
    uid = uuid.UUID(user_id)
    params = intent.params
    action = intent.action

    if action == "today":
        summary = await self.habit_service.get_today_summary(uid)
        return self.habit_service.format_summary_text(summary)  # get_habits_context와 유사

    # title이 필요한 액션 (checkin, uncheckin, update, delete)
    title = params.get("title", "")
    matches = await self.habit_service.find_by_title(uid, title)

    if len(matches) == 0:
        return f"'{title}' 습관을 찾을 수 없습니다."
    if len(matches) > 1:
        names = ", ".join(h.title for h in matches)
        return f"여러 습관이 일치합니다: {names}. 정확한 이름을 말씀해주세요."

    habit = matches[0]
    # 소유권은 find_by_title이 user_id로 필터링하므로 보장됨

    if action == "checkin":
        log = await self.habit_service.checkin(
            habit.id, uid, date.today(),
            completed=True, source="chat",
            value=params.get("value"), note=params.get("note"),
        )
        streak = await self.habit_service.get_streak(habit, date.today())
        return f"✅ '{habit.title}' 체크인 완료! 🔥{streak}일 연속"

    if action == "uncheckin":
        await self.habit_service.checkin(
            habit.id, uid, date.today(),
            completed=False, source="chat",
        )
        return f"⬜ '{habit.title}' 체크인이 취소되었습니다"

    return None  # create/update/delete는 needs_confirmation=true이므로 여기 도달 안 함
```

### 3.4 chat.py WebSocket 라우터 변경

```python
habit_service = HabitService(session)
chat_service = ChatService(session, llm, goal_service=goal_service, habit_service=habit_service)
```

---

## 4. WebSocket 접속 시 리마인더

### 4.1 동작

WebSocket 연결 직후:
1. `habit_service.get_today_summary(uuid.UUID(user_id))` 호출
2. 스케줄된 습관 중 미완료가 1개+ → 리마인더 메시지 전송

### 4.2 메시지 형식

```json
{
  "type": "habit_reminder",
  "message": "오늘 아직 완료하지 않은 습관이 있어요:\n⬜ 운동\n⬜ 독서\n완료: 1/3"
}
```

### 4.3 중복 방지

MVP에서는 매 WebSocket 연결 시 전송하되, **프론트엔드에서 세션당 1회만 표시**:
- `sessionStorage`에 `habit_reminder_shown_{date}` 플래그 저장
- 이미 표시된 날이면 메시지 수신해도 무시

### 4.4 프론트엔드 변경

**파일:** `frontend/src/hooks/useChatWebSocket.ts`의 `onmessage` 핸들러에 분기 추가:

```typescript
if (data.type === "habit_reminder") {
  const key = `habit_reminder_shown_${new Date().toISOString().split("T")[0]}`;
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, "true");
    // habit_reminder 상태 업데이트 → UI 표시
  }
  return;
}
```

**파일:** `frontend/src/app/chat/page.tsx` (또는 `ChatWindow.tsx`):
- habit_reminder 상태가 있으면 알림 배너 표시
- 클릭 시 `/habits` 페이지로 이동, 닫기 버튼으로 dismiss

---

## 5. Google Calendar 리마인더 연동

### 5.1 Habit 모델 변경

```python
# models/models.py — Habit 클래스에 추가
calendar_event_id: Mapped[str | None] = mapped_column(nullable=True)
```

Alembic 마이그레이션으로 컬럼 추가.

### 5.2 HabitCalendarSync 서비스

```python
# domain/habit/calendar_sync.py
class HabitCalendarSync:
    def __init__(self, session: AsyncSession, integration_repo: IntegrationRepository):
        self.session = session
        self.integration_repo = integration_repo

    async def sync_to_calendar(
        self, habit: Habit, user_id: uuid.UUID,
        event_time: str = "09:00", timezone: str = "Asia/Seoul"
    ) -> str | None:
        """습관을 Google Calendar 반복 이벤트로 생성. event_id 반환.
        캘린더 미연동 시 None 반환 (에러 아님)."""
        # 1. integration_repo.get_by_provider(user_id, "google_calendar") → Integration | None
        # 2. Integration 없거나 status != "active" → return None
        # 3. GoogleCalendarProvider(access_token, refresh_token, integration_repo, integration) 생성
        # 4. rrule = frequency_to_rrule(habit.frequency_type, habit.frequency_value)
        # 5. provider.create_event(summary, start, end, recurrence=[rrule], reminders={"useDefault": False, "overrides": [{"method": "popup", "minutes": 30}]})
        # 6. habit.calendar_event_id = event.id → commit
        # 7. return event.id

    async def remove_from_calendar(self, habit: Habit, user_id: uuid.UUID) -> None:
        """습관의 캘린더 이벤트 삭제. calendar_event_id가 None이면 skip."""
        # 1. habit.calendar_event_id가 None이면 return
        # 2. Integration 조회
        # 3. GoogleCalendarProvider.delete_event(habit.calendar_event_id)
        # 4. habit.calendar_event_id = None → commit

    @staticmethod
    def frequency_to_rrule(frequency_type: str, frequency_value: dict) -> str:
        """frequency_type/value → Google Calendar RRULE 문자열 변환"""
```

### 5.3 RRULE 매핑

| frequency_type | frequency_value | RRULE |
|---------------|----------------|-------|
| `daily` | `{}` | `RRULE:FREQ=DAILY` |
| `specific_days` | `{"days": [0,2,4]}` | `RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR` |
| `times_per_week` | `{"times": 3}` | `RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR` (균등 분배) |
| `every_n_days` | `{"interval": 2}` | `RRULE:FREQ=DAILY;INTERVAL=2` |

**times_per_week 요일 분배 규칙:**

| times | 분배 요일 |
|-------|----------|
| 1 | MO |
| 2 | MO,TH |
| 3 | MO,WE,FR |
| 4 | MO,TU,TH,FR |
| 5 | MO,TU,WE,TH,FR |
| 6 | MO,TU,WE,TH,FR,SA |
| 7 | MO,TU,WE,TH,FR,SA,SU |

**weekday index → RRULE BYDAY 매핑:** 0=MO, 1=TU, 2=WE, 3=TH, 4=FR, 5=SA, 6=SU

### 5.4 캘린더 이벤트 기본값

```python
event = {
    "summary": f"[습관] {habit.title}",
    "start": {"dateTime": f"{today}T{event_time}:00", "timeZone": timezone},
    "end": {"dateTime": f"{today}T{event_time_plus_30min}:00", "timeZone": timezone},
    "recurrence": [rrule],
    "reminders": {
        "useDefault": False,
        "overrides": [{"method": "popup", "minutes": 30}]
    }
}
```

### 5.5 동기화 트리거

- **습관 생성 시**: 캘린더 연동된 사용자 → "캘린더에도 추가할까요?" 확인 (채팅에서는 LLM이 질문, UI에서는 HabitForm에 체크박스 추가)
- **습관 일시정지 시**: `remove_from_calendar()`
- **습관 active 복귀 시**: `sync_to_calendar()` 재생성
- **습관 삭제 시**: `remove_from_calendar()`

### 5.6 GoogleCalendarProvider 변경

기존 `create_event` 시그니처에 optional 파라미터 추가 (기존 호출 호환성 유지):

```python
async def create_event(
    self, summary: str, start: str, end: str,
    description: str | None = None,
    recurrence: list[str] | None = None,
    reminders: dict | None = None,
) -> CalendarEvent:
    """start/end는 ISO datetime string. 내부에서 Google API body dict로 변환.
    recurrence와 reminders는 event body에 직접 추가."""
```

`delete_event` 메서드 추가:

```python
async def delete_event(self, event_id: str) -> None:
    """Google Calendar 이벤트 삭제. 토큰 리프레시 포함."""
```

---

## 6. IntegrationService 변경

### 6.1 detect_action_intent 프롬프트 확장

기존 프롬프트에 habit 인텐트 설명 추가. `detect_action_intent`는 **LLM 응답 텍스트**를 입력으로 받는다:

```
가능한 서비스와 액션:
- calendar.create_event: 캘린더 이벤트 생성
- calendar.list_events: 캘린더 이벤트 조회
- habit.checkin: 습관 체크인 (params: title, completed=true, value?, note?)
- habit.uncheckin: 습관 체크인 취소 (params: title)
- habit.today: 오늘 습관 요약 조회 (params: {})
- habit.create: 습관 생성 (params: title, frequency_type, frequency_value, target_value?, target_unit?)
- habit.update: 습관 수정 (params: title, ...변경할 필드)
- habit.delete: 습관 삭제 (params: title)

규칙:
- habit.checkin, habit.uncheckin, habit.today는 needs_confirmation=false
- habit.create, habit.update, habit.delete는 needs_confirmation=true
```

### 6.2 execute_action 확장

```python
async def execute_action(self, user_id: str, intent: ActionIntent) -> dict:
    if intent.service == "calendar":
        # 기존 캘린더 로직
    elif intent.service == "habit":
        return await self._execute_habit_action(user_id, intent)
```

### 6.3 _execute_habit_action 상세

**title → habit 객체 변환 + 소유권 검증:**

```python
async def _execute_habit_action(self, user_id: str, intent: ActionIntent) -> dict:
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
    # 소유권: find_by_title이 user_id로 필터링하므로 보장됨

    if action == "checkin":
        log = await self.habit_service.checkin(habit.id, uid, date.today(), completed=True, source="chat",
                                                value=params.get("value"), note=params.get("note"))
        streak = await self.habit_service.get_streak(habit, date.today())
        return {"success": True, "habit": habit.title, "streak": streak}

    if action == "uncheckin":
        await self.habit_service.checkin(habit.id, uid, date.today(), completed=False, source="chat")
        return {"success": True, "habit": habit.title, "unchecked": True}

    if action == "create":
        new_habit = await self.habit_service.create_habit(uid, **params)
        return {"success": True, "habit": new_habit.title, "created": True}

    if action == "update":
        changes = {k: v for k, v in params.items() if k != "title"}
        updated = await self.habit_service.update_habit(habit, **changes)
        return {"success": True, "habit": updated.title, "updated": True}

    if action == "delete":
        # 소유권: habit은 이미 user_id로 필터링됨
        await self.habit_service.delete_habit(habit.id)
        return {"success": True, "habit": habit.title, "deleted": True}

    return {"success": False, "error": f"Unknown action: {action}"}
```

**주의:** `IntegrationService`에 `habit_service` 의존성 주입 필요:
```python
class IntegrationService:
    def __init__(self, session, llm, habit_service=None):
        ...
        self.habit_service = habit_service
```

---

## 7. 파일 구조

### Backend — Create
| 파일 | 책임 |
|------|------|
| `domain/habit/calendar_sync.py` | HabitCalendarSync (RRULE 변환, 캘린더 이벤트 CRUD) |
| `tests/test_habit_chat_integration.py` | 채팅-습관 통합 테스트 11개 |
| `tests/test_habit_calendar_sync.py` | 캘린더 동기화 테스트 4개 |

### Backend — Modify
| 파일 | 변경 |
|------|------|
| `models/models.py` | Habit에 `calendar_event_id` 필드 추가 |
| `domain/chat/service.py` | +habit_service 주입, +습관 컨텍스트 주입, +_execute_habit_intent |
| `domain/integration/service.py` | +habit_service 주입, detect_action_intent 프롬프트 확장, +_execute_habit_action |
| `domain/integration/calendar.py` | create_event에 recurrence/reminders optional 파라미터, +delete_event |
| `domain/habit/service.py` | +find_by_title, +get_habits_context |
| `api/chat.py` | +HabitService 생성/주입(ChatService, IntegrationService 모두), +접속 시 리마인더 |
| Alembic migration | +calendar_event_id 컬럼 |

### Frontend — Modify
| 파일 | 변경 |
|------|------|
| `hooks/useChatWebSocket.ts` | +habit_reminder 메시지 타입 분기, sessionStorage 중복 방지 |
| `app/chat/page.tsx` 또는 `components/ChatWindow.tsx` | +habit_reminder 알림 배너 UI |

---

## 8. 테스트 전략

### test_habit_chat_integration.py (11개)

| # | 테스트 | 내용 |
|---|--------|------|
| 1 | test_detect_habit_checkin_intent | "운동 했어" → `habit.checkin` 인텐트 감지 |
| 2 | test_checkin_via_chat | habit.checkin 실행 → source="chat", completed=True |
| 3 | test_uncheckin_via_chat | habit.uncheckin 실행 → completed=False |
| 4 | test_detect_habit_today_intent | "오늘 습관 어때?" → `habit.today` 인텐트 감지 |
| 5 | test_detect_habit_create_intent | "물 8잔 습관 추가" → `habit.create`, needs_confirmation=true |
| 6 | test_create_habit_after_confirmation | 확인 후 습관 생성 완료 |
| 7 | test_find_by_title_single_match | "운동" → 1개 매치 → 자동 선택 |
| 8 | test_find_by_title_multiple_matches | "마시" → 2개 매치 → 목록 반환 |
| 9 | test_find_by_title_no_match | "없는습관" → 0개 매치 → 에러 메시지 |
| 10 | test_websocket_habit_reminder | 접속 시 미완료 습관 알림 전송 |
| 11 | test_habits_context_injection | 시스템 프롬프트에 습관 상태 주입 확인 |

### test_habit_calendar_sync.py (5개)

| # | 테스트 | 내용 |
|---|--------|------|
| 12 | test_frequency_to_rrule | 4가지 frequency_type → RRULE 변환 검증 |
| 13 | test_sync_to_calendar | 캘린더 이벤트 생성 + calendar_event_id 저장 |
| 14 | test_remove_from_calendar | 캘린더 이벤트 삭제 + calendar_event_id null |
| 15 | test_delete_habit_removes_calendar | 습관 삭제 시 캘린더 이벤트도 삭제 |
| 16 | test_sync_without_integration | 캘린더 미연동 시 None 반환 (graceful) |

**총 16개 테스트.** LLM 호출은 모킹 (기존 test_goal_chat_integration.py 패턴). 캘린더 API도 모킹.

---

## 9. Chunk 3 제외 항목 (향후)

- 히트맵 시각화
- 트렌드/상관관계 분석
- LLM 기반 코칭 인사이트
- Push notification
