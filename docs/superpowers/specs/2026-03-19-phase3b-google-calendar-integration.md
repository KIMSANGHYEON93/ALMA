# Phase 3B: Google Calendar Integration — 외부 연동 설계

> IntegrationService 스텁을 실제 Google Calendar API 연동으로 확장

## 1. 개요

### 목적
대화 중 캘린더 관련 인텐트를 감지하고, 사용자의 Google Calendar에 실제 이벤트를 생성/조회하는 연동.

### 스코프 (MVP)
- Google OAuth2 연결/해제 (토큰 revoke 포함)
- 캘린더 이벤트 생성 (대화에서 자동 감지)
- 오늘/이번 주 일정 조회
- 대화 중 일정 확인 요청 응답

### 스코프 외 (YAGNI)
- Notion 연동 (별도 Phase)
- 일정 수정/삭제 (Phase 4)
- 반복 일정 관리 (Phase 4)
- 캘린더 동기화/웹훅 (Phase 4)

## 2. 도메인 모델 (DDD)

### Bounded Context: `integration` (기존 확장)

```
domain/integration/
├── __init__.py
├── service.py          IntegrationService (기존 확장)
├── repository.py       ActionLogRepository (기존) + IntegrationRepository (신규)
├── calendar.py         GoogleCalendarProvider (신규)
└── oauth.py            GoogleOAuthService (신규)
```

### ORM 모델 위치
기존 Shared Kernel 패턴을 따라 `models/models.py`에 Integration SQLAlchemy 모델 추가.

### Entity: Integration (신규)

| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| provider | str | google_calendar |
| status | str | active / disconnected / expired |
| access_token | str | Fernet 암호화 저장 |
| refresh_token | str? | Fernet 암호화 저장 (nullable — Google이 재인증 시 미발급 가능) |
| token_expiry | datetime? | 토큰 만료 시각 |
| scopes | str | 부여된 OAuth 스코프 |
| created_at | datetime | 연결 시각 |
| updated_at | datetime | 갱신 시각 (onupdate=func.now()) |

### 보안 설계
- access_token, refresh_token은 **Fernet 대칭 암호화** 후 DB 저장
- 암호화 키는 환경변수 `ENCRYPTION_KEY`로 관리
- 토큰 갱신은 API 호출 시 자동 (expiry 체크)
- 갱신 실패 시 → `status = 'expired'`, 사용자에게 재연결 안내

## 3. OAuth2 플로우

### State 파라미터 CSRF 방어

```python
# state 생성 (connect 엔드포인트)
state = jwt.encode({
    "user_id": str(current_user.id),
    "nonce": secrets.token_urlsafe(32),  # 일회용 랜덤값
    "exp": datetime.utcnow() + timedelta(minutes=10)
}, settings.jwt_secret, algorithm="HS256")
# nonce를 DB (또는 Integration 임시 레코드 status='pending')에 저장

# state 검증 (callback 엔드포인트)
payload = jwt.decode(state, settings.jwt_secret, algorithms=["HS256"])
# nonce 대조 후 삭제 (replay attack 방지)
```

### 플로우

```
1. User → POST /api/integrations/google/connect (인증 필수)
   → 서버: Google OAuth2 URL 생성 (state=JWT with nonce)
   → nonce를 DB에 저장 (pending Integration 레코드)
   → Response: { "auth_url": "https://accounts.google.com/o/oauth2/..." }

2. User → 브라우저에서 Google 로그인 + 권한 허용
   → Google → GET /api/integrations/google/callback?code=...&state=...

3. Server (callback, 인증 불필요 — Google 리다이렉트)
   → state JWT 검증 + nonce 대조
   → Google token exchange (code → access_token + refresh_token)
   → Integration 레코드 업데이트 (토큰 암호화 저장, status='active')
   → Redirect: /chat?integration=connected

4. 이후: API 호출 시 토큰 자동 갱신
```

### OAuth URL 필수 파라미터
```
access_type=offline     # refresh_token 발급 보장
prompt=consent          # 매번 동의 화면 → refresh_token 재발급
scope=https://www.googleapis.com/auth/calendar.events
```

### Callback 에러 처리

| 시나리오 | 처리 |
|----------|------|
| Google이 `error` 파라미터 반환 (사용자 거부) | `/chat?integration=denied` 리다이렉트 |
| state 검증 실패 (만료/변조) | `/chat?integration=error&reason=invalid_state` 리다이렉트 |
| token exchange 실패 | `/chat?integration=error&reason=token_exchange` 리다이렉트 |
| 이미 연결된 상태에서 재연결 | 기존 토큰 업데이트 (UPSERT) |

### Google Cloud 설정 필요
- Google Cloud Console 프로젝트
- OAuth2 Consent Screen (External, Testing)
- OAuth2 Client ID (Web application)
- Redirect URI: `http://localhost:8000/api/integrations/google/callback`
- Scope: `https://www.googleapis.com/auth/calendar.events` (생성+조회 모두 필요하므로 events 전체)

## 4. API 엔드포인트

### `api/integrations.py` — Router prefix: `/api/integrations`

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | `/api/integrations` | 필수 | 사용자 연동 목록 |
| POST | `/api/integrations/google/connect` | 필수 | OAuth2 시작 → auth_url 반환 |
| GET | `/api/integrations/google/callback` | 불필요 | OAuth2 콜백 (state JWT로 사용자 식별) |
| DELETE | `/api/integrations/{id}` | 필수 | 연동 해제 (Google revoke + DB 삭제) |
| GET | `/api/integrations/google/calendar/events` | 필수 | 일정 조회 (today/week 필터) |
| POST | `/api/integrations/google/calendar/events` | 필수 | 일정 생성 |

## 5. GoogleCalendarProvider

### Async 전략
Google의 `google-api-python-client`는 동기 라이브러리. `asyncio.to_thread()`로 래핑 (Gemini 임베딩과 동일 패턴).

```python
class GoogleCalendarProvider:
    """Google Calendar API v3 래퍼 (asyncio.to_thread 기반)"""

    async def list_events(self, time_min, time_max, max_results=10) -> list[CalendarEvent]
    async def create_event(self, summary, start, end, description=None) -> CalendarEvent
    async def _refresh_token_if_needed(self) -> None
    # 갱신 실패 시 IntegrationRepository.update_status('expired') 호출
```

### CalendarEvent 값 객체
```python
@dataclass
class CalendarEvent:
    id: str
    summary: str
    start: datetime        # timezone-aware (UTC 또는 사용자 timezone)
    end: datetime          # timezone-aware
    timezone: str | None = None
    description: str | None = None
    location: str | None = None
    html_link: str | None = None
```

## 6. IntegrationService 수정 (하위 호환)

### 시그니처 변경
`_execute_calendar_action`과 `_execute_notion_action` 모두 `user_id` 파라미터 추가.
`execute_action` 메서드에서 `user_id`를 private 메서드로 전달하도록 수정:

```python
async def execute_action(self, user_id: str, intent: ActionIntent) -> dict:
    # ... 기존 로직
    if intent.service == "calendar":
        result = await self._execute_calendar_action(user_id, intent)  # user_id 전달
    elif intent.service == "notion":
        result = await self._execute_notion_action(user_id, intent)    # 동일 시그니처
    # ...

async def _execute_calendar_action(self, user_id: str, intent: ActionIntent) -> dict:
    integration = await self.integration_repo.get_active(user_id, "google_calendar")
    if not integration:
        return {"error": "Google Calendar not connected", "connect_url": "/api/integrations/google/connect"}

    provider = GoogleCalendarProvider(integration, self.integration_repo)
    if intent.action == "create_event":
        event = await provider.create_event(**intent.params)
        return {"status": "created", "event": asdict(event)}
    elif intent.action == "list_events":
        events = await provider.list_events(**intent.params)
        return {"status": "ok", "events": [asdict(e) for e in events]}
```

**주의:** `execute_action`은 현재 ChatService에서 직접 호출되지 않음 (확인 후 호출). 시그니처 변경은 안전.

### DELETE 시 Google 토큰 Revoke
```python
async def disconnect(self, integration_id: UUID, user_id: UUID):
    integration = await self.integration_repo.get(integration_id)
    # 소유권 검증
    if integration.user_id != user_id:
        raise PermissionError
    # Google 토큰 revoke
    await self._revoke_google_token(integration.access_token)
    # DB 삭제
    await self.integration_repo.delete(integration_id)

async def _revoke_google_token(self, encrypted_token: str):
    token = decrypt(encrypted_token)
    async with httpx.AsyncClient() as client:
        await client.post("https://oauth2.googleapis.com/revoke", params={"token": token})
```

## 7. DB 테이블 (Alembic 마이그레이션)

```sql
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','active','disconnected','expired')),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expiry TIMESTAMP,
    scopes TEXT,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);
CREATE UNIQUE INDEX idx_integrations_user_provider ON integrations(user_id, provider);
```

## 8. 환경변수 추가

### Settings 클래스 (`config.py`) 추가 필드
```python
# config.py Settings 추가
google_client_id: str = ""
google_client_secret: str = ""
google_redirect_uri: str = "http://localhost:8000/api/integrations/google/callback"
encryption_key: str = ""  # Fernet key
```

### .env 추가
```env
# Google OAuth2
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8000/api/integrations/google/callback

# Token Encryption
ENCRYPTION_KEY=...  # python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## 9. 의존성 추가

```toml
# pyproject.toml
dependencies = [
    # ... 기존
    "google-api-python-client>=2.0",    # Google Calendar API
    "google-auth-oauthlib>=1.0",         # OAuth2 flow
    "google-auth>=2.0",                  # Auth base (httplib2 불필요 — asyncio.to_thread 사용)
    "cryptography>=42.0",               # Fernet 토큰 암호화
    "httpx>=0.27",                       # Token revoke 비동기 HTTP
]
```

## 10. 테스트 전략

| 테스트 파일 | 범위 |
|------------|------|
| test_oauth.py | OAuth2 플로우 + state CSRF 검증 + callback 에러 처리 |
| test_calendar_provider.py | CalendarEvent 생성/조회 (mock Google API) |
| test_integration_api.py | API 엔드포인트 + 인증 + 소유권 |
| test_token_encryption.py | Fernet 암호화/복호화 + 토큰 갱신 실패 처리 |

### 핵심 테스트 케이스
1. OAuth2 URL 생성 → state JWT에 nonce + exp 포함
2. Callback 성공 → 토큰 암호화 저장 → Integration status='active'
3. Callback state 검증 실패 → 에러 리다이렉트
4. Callback 사용자 거부 (error param) → denied 리다이렉트
5. 토큰 만료 → 자동 갱신 성공
6. refresh_token 만료 → status='expired' 전환
7. 연동 해제 → Google revoke + DB 삭제
8. 이미 연결된 상태에서 재연결 → UPSERT (토큰 갱신)
9. 미연동 상태에서 캘린더 API 호출 → connect_url 안내
10. 기존 IntegrationService 테스트 깨지지 않음

## 11. 성공 기준

- [ ] Google OAuth2 연결/해제 동작 (CSRF 방어 포함)
- [ ] 토큰 Fernet 암호화 저장/복호화/자동 갱신
- [ ] 갱신 실패 시 status='expired' + 재연결 안내
- [ ] 캘린더 이벤트 생성 API (timezone-aware)
- [ ] 캘린더 일정 조회 API
- [ ] ChatService → IntegrationService → Calendar 실제 연동
- [ ] DELETE 시 Google 토큰 revoke
- [ ] 10+ 테스트 통과
- [ ] 기존 테스트 깨지지 않음
