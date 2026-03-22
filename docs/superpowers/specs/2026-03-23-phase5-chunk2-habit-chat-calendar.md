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

기존 `IntegrationService.detect_action_intent()` 시스템 프롬프트에 habit 인텐트를 추가한다.

| 인텐트 | 예시 발화 | 실행 방식 | 파라미터 |
|--------|----------|----------|---------|
| `habit.checkin` | "운동 했어", "물 6잔 마심" | 자동 | `{title, completed: true, value?, note?}` |
| `habit.uncheckin` | "운동 취소", "아 안했어" | 자동 | `{title}` |
| `habit.today` | "오늘 습관 어때?" | 자동 | `{}` |
| `habit.create` | "매일 물 8잔 습관 추가해줘" | 확인 필요 | `{title, frequency_type, frequency_value, target_value?, target_unit?}` |
| `habit.update` | "운동 주 5회로 바꿔줘" | 확인 필요 | `{title, ...changes}` |
| `habit.delete` | "운동 습관 삭제해줘" | 확인 필요 | `{title}` |

### 2.2 실행 방식

- **자동 실행** (checkin, uncheckin, today): 인텐트 감지 즉시 실행, 결과를 LLM 응답에 포함
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

### 3.2 process_message 흐름 변경

1. (기존) 벡터 검색 → 히스토리 → 시스템 프롬프트 조립
2. **(추가)** `habit_service.get_habits_context(user_id)` → 시스템 프롬프트에 습관 상태 주입
3. (기존) LLM 호출
4. (기존) `detect_action_intent()` — habit.* 인텐트 포함
5. **(추가)** habit 인텐트 실행:
   - `habit.checkin` → `habit_service.checkin(habit_id, user_id, today, completed=True, source="chat", value=params.get("value"), note=params.get("note"))`
   - `habit.uncheckin` → `habit_service.checkin(habit_id, user_id, today, completed=False, source="chat")`
   - `habit.today` → `habit_service.get_today_summary(user_id)` 결과를 응답에 포함
   - `habit.create` → 확인 후 `habit_service.create_habit(...)`
   - `habit.update` → 확인 후 `habit_service.update_habit(...)`
   - `habit.delete` → 확인 후 `habit_service.delete_habit(...)`
6. (기존) 메시지 저장

### 3.3 인텐트 실행 결과 포맷

habit 인텐트 실행 후 결과를 자연어로 변환하여 LLM 응답에 추가:

- checkin 성공: `"✅ '운동' 체크인 완료! 🔥3일 연속"`
- uncheckin: `"⬜ '운동' 체크인이 취소되었습니다"`
- today: 요약 텍스트 (get_habits_context 형식)
- create 확인: `"'물 마시기' 습관을 추가할까요? (매일, 목표: 8잔)"`
- create 완료: `"✅ '물 마시기' 습관이 추가되었습니다"`

### 3.4 chat.py WebSocket 라우터 변경

```python
habit_service = HabitService(session)
chat_service = ChatService(session, llm, goal_service=goal_service, habit_service=habit_service)
```

---

## 4. WebSocket 접속 시 리마인더

### 4.1 동작

WebSocket 연결 직후:
1. `habit_service.get_today_summary(user_id)` 호출
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

`frontend/src/app/chat/page.tsx` (또는 채팅 WebSocket 핸들러):
- `type: "habit_reminder"` 메시지 수신 시 알림 UI 표시
- 알림 클릭 시 `/habits` 페이지로 이동 가능

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
    def __init__(self, session: AsyncSession):
        self.session = session

    async def sync_to_calendar(self, habit: Habit, user_id: uuid.UUID, event_time: str = "09:00") -> str | None:
        """습관을 Google Calendar 반복 이벤트로 생성. event_id 반환."""
        # 1. Integration 조회 (google_calendar, status=active)
        # 2. GoogleCalendarProvider 생성
        # 3. RRULE 생성
        # 4. create_event (summary, start, end, recurrence, reminders)
        # 5. habit.calendar_event_id = event_id, commit
        # 6. return event_id

    async def remove_from_calendar(self, habit: Habit, user_id: uuid.UUID) -> None:
        """습관의 캘린더 이벤트 삭제."""
        # 1. habit.calendar_event_id가 None이면 skip
        # 2. Integration 조회
        # 3. GoogleCalendarProvider.delete_event(event_id)
        # 4. habit.calendar_event_id = None, commit

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

기존 `create_event`에 `recurrence` 와 `reminders` 파라미터 추가:

```python
async def create_event(
    self, summary, start, end,
    description=None, recurrence=None, reminders=None
) -> CalendarEvent:
```

`delete_event` 메서드 추가:

```python
async def delete_event(self, event_id: str) -> None:
```

---

## 6. IntegrationService 변경

### 6.1 detect_action_intent 프롬프트 확장

기존 프롬프트에 habit 인텐트 설명 추가:

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
async def execute_action(self, user_id, intent):
    if intent.service == "calendar":
        # 기존 캘린더 로직
    elif intent.service == "habit":
        return await self._execute_habit_action(user_id, intent)
```

`_execute_habit_action`은 HabitService를 호출하여 인텐트별 처리.

---

## 7. 파일 구조

### Backend — Create
| 파일 | 책임 |
|------|------|
| `domain/habit/calendar_sync.py` | HabitCalendarSync (RRULE 변환, 캘린더 이벤트 CRUD) |
| `tests/test_habit_chat_integration.py` | 채팅-습관 통합 테스트 8개 |
| `tests/test_habit_calendar_sync.py` | 캘린더 동기화 테스트 4개 |

### Backend — Modify
| 파일 | 변경 |
|------|------|
| `models/models.py` | Habit에 `calendar_event_id` 필드 추가 |
| `domain/chat/service.py` | +habit_service 주입, +습관 컨텍스트 주입, +habit 인텐트 실행 |
| `domain/integration/service.py` | detect_action_intent 프롬프트 확장, +_execute_habit_action |
| `domain/integration/calendar.py` | create_event에 recurrence/reminders 파라미터, +delete_event |
| `domain/habit/service.py` | +find_by_title, +get_habits_context |
| `api/chat.py` | +HabitService 생성/주입, +접속 시 리마인더 |
| Alembic migration | +calendar_event_id 컬럼 |

### Frontend — Modify
| 파일 | 변경 |
|------|------|
| `app/chat/page.tsx` (또는 채팅 컴포넌트) | +habit_reminder 메시지 타입 처리, sessionStorage 중복 방지 |

---

## 8. 테스트 전략

### test_habit_chat_integration.py (8개)

| # | 테스트 | 내용 |
|---|--------|------|
| 1 | test_detect_habit_checkin_intent | "운동 했어" → `habit.checkin` 인텐트 감지 |
| 2 | test_checkin_via_chat | habit.checkin 실행 → source="chat", completed=True |
| 3 | test_detect_habit_today_intent | "오늘 습관 어때?" → `habit.today` 인텐트 감지 |
| 4 | test_detect_habit_create_intent | "물 8잔 습관 추가" → `habit.create`, needs_confirmation=true |
| 5 | test_create_habit_after_confirmation | 확인 후 습관 생성 완료 |
| 6 | test_find_by_title_single_match | "운동" → 1개 매치 → 자동 선택 |
| 7 | test_find_by_title_multiple_matches | "마시" → 2개 매치 → 목록 반환 |
| 8 | test_websocket_habit_reminder | 접속 시 미완료 습관 알림 전송 |

### test_habit_calendar_sync.py (4개)

| # | 테스트 | 내용 |
|---|--------|------|
| 9 | test_frequency_to_rrule | 4가지 frequency_type → RRULE 변환 검증 |
| 10 | test_sync_to_calendar | 캘린더 이벤트 생성 + calendar_event_id 저장 |
| 11 | test_remove_from_calendar | 캘린더 이벤트 삭제 + calendar_event_id null |
| 12 | test_delete_habit_removes_calendar | 습관 삭제 시 캘린더 이벤트도 삭제 |

**LLM 호출은 모킹** (기존 test_goal_chat_integration.py 패턴). 캘린더 API도 모킹.

---

## 9. Chunk 3 제외 항목 (향후)

- 히트맵 시각화
- 트렌드/상관관계 분석
- LLM 기반 코칭 인사이트
- Push notification
