# Google Calendar Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google Calendar OAuth2 연동 — 대화에서 일정 생성/조회 자동 처리

**Architecture:** 기존 integration 바운디드 컨텍스트 확장. OAuth2 연결 → 토큰 암호화 저장 → GoogleCalendarProvider로 API 호출. IntegrationService 스텁을 실제 구현으로 교체. async 비호환 Google SDK는 asyncio.to_thread()로 래핑.

**Tech Stack:** Python, FastAPI, google-api-python-client, google-auth-oauthlib, cryptography (Fernet), httpx, Supabase PostgreSQL

**Spec:** `docs/superpowers/specs/2026-03-19-phase3b-google-calendar-integration.md`

---

## File Structure

### Create
| File | Responsibility |
|------|----------------|
| `backend/src/alma/domain/integration/oauth.py` | GoogleOAuthService (URL 생성, token exchange, state 검증) |
| `backend/src/alma/domain/integration/calendar.py` | GoogleCalendarProvider (이벤트 생성/조회, 토큰 갱신) |
| `backend/src/alma/domain/integration/crypto.py` | Fernet 암호화/복호화 유틸 |
| `backend/src/alma/api/integrations.py` | Integrations API 라우터 (6 endpoints) |
| `backend/tests/test_oauth.py` | OAuth2 플로우 + CSRF 테스트 |
| `backend/tests/test_calendar_provider.py` | Calendar 생성/조회 mock 테스트 |
| `backend/tests/test_token_encryption.py` | Fernet 암호화 테스트 |
| `backend/tests/test_integration_api.py` | API 엔드포인트 테스트 |

### Modify
| File | Change |
|------|--------|
| `backend/src/alma/models/models.py` | Integration ORM 모델 추가 |
| `backend/src/alma/config.py` | Google OAuth + encryption 설정 추가 |
| `backend/src/alma/main.py` | integrations_router 등록 |
| `backend/src/alma/domain/integration/service.py` | _execute_calendar_action 실제 구현 |
| `backend/src/alma/domain/integration/repository.py` | IntegrationRepository 추가 |
| `backend/pyproject.toml` | 새 의존성 추가 |

---

## Chunk 1: 기반 (모델 + 암호화 + 의존성)

### Task 1: 의존성 추가 + Settings 확장

**Files:**
- Modify: `backend/pyproject.toml`
- Modify: `backend/src/alma/config.py`

- [ ] **Step 1: pyproject.toml에 의존성 추가**

```toml
# dependencies 배열에 추가
"google-api-python-client>=2.0",
"google-auth-oauthlib>=1.0",
"google-auth>=2.0",
"cryptography>=42.0",
"httpx>=0.27",
```

- [ ] **Step 2: pip install**

Run: `cd backend && pip install -e ".[dev]"` 또는 `pip install google-api-python-client google-auth-oauthlib google-auth cryptography httpx`

- [ ] **Step 3: config.py Settings 확장**

```python
# config.py Settings 클래스에 추가
google_client_id: str = ""
google_client_secret: str = ""
google_redirect_uri: str = "http://localhost:8000/api/integrations/google/callback"
encryption_key: str = ""  # Fernet key
```

- [ ] **Step 4: .env에 키 추가**

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/api/integrations/google/callback
ENCRYPTION_KEY=  # python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

- [ ] **Step 5: Commit**

```bash
git add backend/pyproject.toml backend/src/alma/config.py backend/.env.example
git commit -m "chore: add Google Calendar and encryption dependencies"
```

---

### Task 2: Integration ORM 모델 + 마이그레이션

**Files:**
- Modify: `backend/src/alma/models/models.py`

- [ ] **Step 1: Integration 모델 추가**

`models/models.py` 하단에 추가:

```python
class Integration(Base):
    __tablename__ = "integrations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    provider: Mapped[str] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(nullable=False, default="pending")
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expiry: Mapped[datetime | None] = mapped_column(nullable=True)
    scopes: Mapped[str | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_integrations_user_provider", "user_id", "provider", unique=True),
    )
```

- [ ] **Step 2: Alembic 마이그레이션 실행**

Run:
```bash
cd backend
DATABASE_URL="$DATABASE_URL" alembic revision --autogenerate -m "add integrations table"
DATABASE_URL="$DATABASE_URL" alembic upgrade head
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/alma/models/models.py backend/alembic/versions/
git commit -m "feat: add Integration ORM model and migration"
```

---

### Task 3: Fernet 암호화 유틸

**Files:**
- Create: `backend/src/alma/domain/integration/crypto.py`
- Create: `backend/tests/test_token_encryption.py`

- [ ] **Step 1: 암호화 유틸 작성**

```python
# backend/src/alma/domain/integration/crypto.py
from cryptography.fernet import Fernet

from alma.config import settings


def get_fernet() -> Fernet:
    key = settings.encryption_key
    if not key:
        raise ValueError("ENCRYPTION_KEY not set")
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_token(token: str) -> str:
    f = get_fernet()
    return f.encrypt(token.encode()).decode()


def decrypt_token(encrypted: str) -> str:
    f = get_fernet()
    return f.decrypt(encrypted.encode()).decode()
```

- [ ] **Step 2: 테스트 작성**

```python
# backend/tests/test_token_encryption.py
import pytest
from unittest.mock import patch
from cryptography.fernet import Fernet


def test_encrypt_decrypt():
    key = Fernet.generate_key().decode()
    with patch("alma.domain.integration.crypto.settings") as mock_settings:
        mock_settings.encryption_key = key
        from alma.domain.integration.crypto import encrypt_token, decrypt_token
        original = "ya29.a0AfH6SMBx..."
        encrypted = encrypt_token(original)
        assert encrypted != original
        decrypted = decrypt_token(encrypted)
        assert decrypted == original


def test_encrypt_no_key():
    with patch("alma.domain.integration.crypto.settings") as mock_settings:
        mock_settings.encryption_key = ""
        from alma.domain.integration.crypto import get_fernet
        with pytest.raises(ValueError):
            get_fernet()
```

- [ ] **Step 3: 테스트 실행**

Run: `cd backend && python -m pytest tests/test_token_encryption.py -v`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/alma/domain/integration/crypto.py backend/tests/test_token_encryption.py
git commit -m "feat: add Fernet token encryption utility with tests"
```

---

## Chunk 2: OAuth2 + Calendar Provider

### Task 4: IntegrationRepository 추가

**Files:**
- Modify: `backend/src/alma/domain/integration/repository.py`

- [ ] **Step 1: IntegrationRepository 추가**

`repository.py`에 추가:

```python
from alma.models.models import ActionLog, Integration
from sqlalchemy import select


class IntegrationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_or_update(self, user_id: uuid.UUID, provider: str,
                                access_token: str, refresh_token: str | None,
                                token_expiry=None, scopes: str | None = None) -> Integration:
        result = await self.session.execute(
            select(Integration).where(
                Integration.user_id == user_id,
                Integration.provider == provider,
            )
        )
        integration = result.scalar_one_or_none()
        if integration:
            integration.access_token = access_token
            integration.refresh_token = refresh_token or integration.refresh_token
            integration.token_expiry = token_expiry
            integration.status = "active"
        else:
            integration = Integration(
                user_id=user_id, provider=provider,
                access_token=access_token, refresh_token=refresh_token,
                token_expiry=token_expiry, scopes=scopes, status="active",
            )
            self.session.add(integration)
        await self.session.commit()
        await self.session.refresh(integration)
        return integration

    async def get_active(self, user_id: uuid.UUID, provider: str) -> Integration | None:
        result = await self.session.execute(
            select(Integration).where(
                Integration.user_id == user_id,
                Integration.provider == provider,
                Integration.status == "active",
            )
        )
        return result.scalar_one_or_none()

    async def get(self, integration_id: uuid.UUID) -> Integration | None:
        result = await self.session.execute(
            select(Integration).where(Integration.id == integration_id)
        )
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: uuid.UUID) -> list[Integration]:
        result = await self.session.execute(
            select(Integration).where(Integration.user_id == user_id)
        )
        return list(result.scalars().all())

    async def update_status(self, integration: Integration, status: str) -> Integration:
        integration.status = status
        await self.session.commit()
        await self.session.refresh(integration)
        return integration

    async def delete(self, integration_id: uuid.UUID) -> None:
        integration = await self.get(integration_id)
        if integration:
            await self.session.delete(integration)
            await self.session.commit()
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/alma/domain/integration/repository.py
git commit -m "feat: add IntegrationRepository (CRUD + UPSERT)"
```

---

### Task 5: GoogleOAuthService

**Files:**
- Create: `backend/src/alma/domain/integration/oauth.py`
- Create: `backend/tests/test_oauth.py`

- [ ] **Step 1: OAuth 서비스 작성**

```python
# backend/src/alma/domain/integration/oauth.py
import secrets
from datetime import datetime, timedelta

from jose import jwt
from google_auth_oauthlib.flow import Flow

from alma.config import settings


SCOPES = ["https://www.googleapis.com/auth/calendar.events"]


class GoogleOAuthService:
    @staticmethod
    def generate_auth_url(user_id: str) -> tuple[str, str]:
        """Returns (auth_url, state_jwt)"""
        nonce = secrets.token_urlsafe(32)
        state = jwt.encode(
            {
                "user_id": user_id,
                "nonce": nonce,
                "exp": datetime.utcnow() + timedelta(minutes=10),
            },
            settings.jwt_secret,
            algorithm="HS256",
        )

        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uris": [settings.google_redirect_uri],
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=SCOPES,
        )
        flow.redirect_uri = settings.google_redirect_uri
        auth_url, _ = flow.authorization_url(
            access_type="offline",
            prompt="consent",
            state=state,
        )
        return auth_url, nonce

    @staticmethod
    def verify_state(state: str) -> dict:
        """Returns decoded payload or raises"""
        return jwt.decode(state, settings.jwt_secret, algorithms=["HS256"])

    @staticmethod
    def exchange_code(code: str) -> dict:
        """Exchange auth code for tokens. Returns dict with access_token, refresh_token, expiry."""
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uris": [settings.google_redirect_uri],
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=SCOPES,
        )
        flow.redirect_uri = settings.google_redirect_uri
        flow.fetch_token(code=code)
        credentials = flow.credentials
        return {
            "access_token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "expiry": credentials.expiry,
        }
```

- [ ] **Step 2: 테스트 작성**

```python
# backend/tests/test_oauth.py
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from jose import jwt


def test_state_generation_and_verification():
    with patch("alma.domain.integration.oauth.settings") as mock_settings:
        mock_settings.jwt_secret = "test-secret"
        mock_settings.google_client_id = "test-client-id"
        mock_settings.google_client_secret = "test-secret"
        mock_settings.google_redirect_uri = "http://localhost:8000/callback"
        from alma.domain.integration.oauth import GoogleOAuthService

        # Verify state contains nonce and user_id
        state = jwt.encode(
            {"user_id": "user-123", "nonce": "abc", "exp": datetime.utcnow() + timedelta(minutes=10)},
            "test-secret", algorithm="HS256"
        )
        payload = GoogleOAuthService.verify_state(state)
        assert payload["user_id"] == "user-123"
        assert payload["nonce"] == "abc"


def test_expired_state_rejected():
    with patch("alma.domain.integration.oauth.settings") as mock_settings:
        mock_settings.jwt_secret = "test-secret"
        from alma.domain.integration.oauth import GoogleOAuthService

        state = jwt.encode(
            {"user_id": "user-123", "nonce": "abc", "exp": datetime.utcnow() - timedelta(minutes=1)},
            "test-secret", algorithm="HS256"
        )
        with pytest.raises(Exception):  # ExpiredSignatureError
            GoogleOAuthService.verify_state(state)


def test_invalid_state_rejected():
    with patch("alma.domain.integration.oauth.settings") as mock_settings:
        mock_settings.jwt_secret = "test-secret"
        from alma.domain.integration.oauth import GoogleOAuthService

        with pytest.raises(Exception):  # JWTError
            GoogleOAuthService.verify_state("invalid-jwt-token")
```

- [ ] **Step 3: 테스트 실행**

Run: `cd backend && python -m pytest tests/test_oauth.py -v`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/alma/domain/integration/oauth.py backend/tests/test_oauth.py
git commit -m "feat: add GoogleOAuthService with CSRF state protection"
```

---

### Task 6: GoogleCalendarProvider

**Files:**
- Create: `backend/src/alma/domain/integration/calendar.py`
- Create: `backend/tests/test_calendar_provider.py`

- [ ] **Step 1: Calendar Provider 작성**

```python
# backend/src/alma/domain/integration/calendar.py
import asyncio
from dataclasses import dataclass, asdict
from datetime import datetime

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from alma.config import settings
from alma.domain.integration.crypto import decrypt_token, encrypt_token


@dataclass
class CalendarEvent:
    id: str
    summary: str
    start: datetime
    end: datetime
    timezone: str | None = None
    description: str | None = None
    location: str | None = None
    html_link: str | None = None


class GoogleCalendarProvider:
    def __init__(self, integration, integration_repo=None):
        self.integration = integration
        self.integration_repo = integration_repo

    def _get_credentials(self) -> Credentials:
        return Credentials(
            token=decrypt_token(self.integration.access_token),
            refresh_token=decrypt_token(self.integration.refresh_token) if self.integration.refresh_token else None,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
        )

    def _build_service(self, credentials):
        return build("calendar", "v3", credentials=credentials)

    async def _refresh_token_if_needed(self) -> None:
        if self.integration.token_expiry and datetime.utcnow() < self.integration.token_expiry:
            return
        # Token expired, try refresh
        try:
            creds = self._get_credentials()
            def _refresh():
                from google.auth.transport.requests import Request
                creds.refresh(Request())
                return creds
            creds = await asyncio.to_thread(_refresh)
            self.integration.access_token = encrypt_token(creds.token)
            self.integration.token_expiry = creds.expiry
            if self.integration_repo:
                await self.integration_repo.update_status(self.integration, "active")
        except Exception:
            if self.integration_repo:
                await self.integration_repo.update_status(self.integration, "expired")
            raise

    async def list_events(self, time_min: str, time_max: str, max_results: int = 10) -> list[CalendarEvent]:
        await self._refresh_token_if_needed()
        creds = self._get_credentials()

        def _list():
            service = self._build_service(creds)
            result = service.events().list(
                calendarId="primary",
                timeMin=time_min,
                timeMax=time_max,
                maxResults=max_results,
                singleEvents=True,
                orderBy="startTime",
            ).execute()
            return result.get("items", [])

        items = await asyncio.to_thread(_list)
        return [self._parse_event(item) for item in items]

    async def create_event(self, summary: str, start: str, end: str,
                           description: str | None = None) -> CalendarEvent:
        await self._refresh_token_if_needed()
        creds = self._get_credentials()

        event_body = {
            "summary": summary,
            "start": {"dateTime": start},
            "end": {"dateTime": end},
        }
        if description:
            event_body["description"] = description

        def _create():
            service = self._build_service(creds)
            return service.events().insert(calendarId="primary", body=event_body).execute()

        result = await asyncio.to_thread(_create)
        return self._parse_event(result)

    @staticmethod
    def _parse_event(item: dict) -> CalendarEvent:
        start = item.get("start", {})
        end = item.get("end", {})
        return CalendarEvent(
            id=item.get("id", ""),
            summary=item.get("summary", ""),
            start=start.get("dateTime", start.get("date", "")),
            end=end.get("dateTime", end.get("date", "")),
            timezone=start.get("timeZone"),
            description=item.get("description"),
            location=item.get("location"),
            html_link=item.get("htmlLink"),
        )
```

- [ ] **Step 2: 테스트 작성 (mock Google API)**

```python
# backend/tests/test_calendar_provider.py
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from alma.domain.integration.calendar import GoogleCalendarProvider, CalendarEvent


def test_parse_event():
    item = {
        "id": "evt-1",
        "summary": "Team Meeting",
        "start": {"dateTime": "2026-03-20T15:00:00+09:00", "timeZone": "Asia/Seoul"},
        "end": {"dateTime": "2026-03-20T16:00:00+09:00"},
        "htmlLink": "https://calendar.google.com/event?eid=xxx",
    }
    event = GoogleCalendarProvider._parse_event(item)
    assert event.summary == "Team Meeting"
    assert event.timezone == "Asia/Seoul"
    assert event.html_link is not None


def test_calendar_event_dataclass():
    event = CalendarEvent(
        id="1", summary="Test", start="2026-03-20T10:00:00",
        end="2026-03-20T11:00:00", timezone="UTC"
    )
    assert event.summary == "Test"
    assert event.timezone == "UTC"
```

- [ ] **Step 3: 테스트 실행**

Run: `cd backend && python -m pytest tests/test_calendar_provider.py -v`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/alma/domain/integration/calendar.py backend/tests/test_calendar_provider.py
git commit -m "feat: add GoogleCalendarProvider with async wrapper"
```

---

## Chunk 3: API 라우터 + IntegrationService 연동

### Task 7: Integrations API 라우터

**Files:**
- Create: `backend/src/alma/api/integrations.py`
- Modify: `backend/src/alma/main.py`

- [ ] **Step 1: API 라우터 작성**

```python
# backend/src/alma/api/integrations.py
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.dependencies import get_current_user
from alma.database import get_session
from alma.models.models import User
from alma.domain.integration.oauth import GoogleOAuthService
from alma.domain.integration.repository import IntegrationRepository
from alma.domain.integration.crypto import encrypt_token
from alma.config import settings

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


class IntegrationResponse(BaseModel):
    id: str
    provider: str
    status: str
    created_at: str
    model_config = {"from_attributes": True}


class AuthUrlResponse(BaseModel):
    auth_url: str


@router.get("", response_model=list[IntegrationResponse])
async def list_integrations(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = IntegrationRepository(session)
    integrations = await repo.list_by_user(user.id)
    return [
        IntegrationResponse(
            id=str(i.id), provider=i.provider, status=i.status,
            created_at=i.created_at.isoformat()
        ) for i in integrations
    ]


@router.post("/google/connect", response_model=AuthUrlResponse)
async def connect_google(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")
    auth_url, nonce = GoogleOAuthService.generate_auth_url(str(user.id))
    # Store pending integration with nonce
    repo = IntegrationRepository(session)
    await repo.create_or_update(
        user_id=user.id, provider="google_calendar",
        access_token=encrypt_token(nonce),  # Store nonce temporarily
        status="pending",
    )
    return AuthUrlResponse(auth_url=auth_url)


@router.get("/google/callback")
async def google_callback(
    code: str = Query(default=None),
    state: str = Query(default=None),
    error: str = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    # Error from Google (user denied)
    if error:
        return RedirectResponse(url="/chat?integration=denied")

    if not code or not state:
        return RedirectResponse(url="/chat?integration=error&reason=missing_params")

    # Verify state JWT
    try:
        payload = GoogleOAuthService.verify_state(state)
        user_id = payload["user_id"]
    except Exception:
        return RedirectResponse(url="/chat?integration=error&reason=invalid_state")

    # Exchange code for tokens
    try:
        tokens = GoogleOAuthService.exchange_code(code)
    except Exception:
        return RedirectResponse(url="/chat?integration=error&reason=token_exchange")

    # Store encrypted tokens
    repo = IntegrationRepository(session)
    await repo.create_or_update(
        user_id=user_id,
        provider="google_calendar",
        access_token=encrypt_token(tokens["access_token"]),
        refresh_token=encrypt_token(tokens["refresh_token"]) if tokens.get("refresh_token") else None,
        token_expiry=tokens.get("expiry"),
        scopes="calendar.events",
    )

    return RedirectResponse(url="/chat?integration=connected")


@router.delete("/{integration_id}", status_code=204)
async def disconnect_integration(
    integration_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = IntegrationRepository(session)
    integration = await repo.get(integration_id)
    if not integration or integration.user_id != user.id:
        raise HTTPException(status_code=404, detail="Integration not found")

    # Revoke Google token
    try:
        import httpx
        token = decrypt_token(integration.access_token)
        async with httpx.AsyncClient() as client:
            await client.post(
                "https://oauth2.googleapis.com/revoke",
                params={"token": token}
            )
    except Exception:
        pass  # Best effort revoke

    await repo.delete(integration.id)


@router.get("/google/calendar/events")
async def list_calendar_events(
    period: str = Query(default="today", regex="^(today|week)$"),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = IntegrationRepository(session)
    integration = await repo.get_active(user.id, "google_calendar")
    if not integration:
        raise HTTPException(status_code=404, detail="Google Calendar not connected")

    from alma.domain.integration.calendar import GoogleCalendarProvider
    from datetime import datetime, timedelta
    provider = GoogleCalendarProvider(integration, repo)

    now = datetime.utcnow()
    if period == "today":
        time_min = now.replace(hour=0, minute=0, second=0).isoformat() + "Z"
        time_max = now.replace(hour=23, minute=59, second=59).isoformat() + "Z"
    else:  # week
        time_min = now.isoformat() + "Z"
        time_max = (now + timedelta(days=7)).isoformat() + "Z"

    events = await provider.list_events(time_min, time_max)
    return [
        {"id": e.id, "summary": e.summary, "start": str(e.start),
         "end": str(e.end), "timezone": e.timezone}
        for e in events
    ]


@router.post("/google/calendar/events")
async def create_calendar_event(
    event: dict,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = IntegrationRepository(session)
    integration = await repo.get_active(user.id, "google_calendar")
    if not integration:
        raise HTTPException(status_code=404, detail="Google Calendar not connected")

    from alma.domain.integration.calendar import GoogleCalendarProvider
    provider = GoogleCalendarProvider(integration, repo)
    result = await provider.create_event(
        summary=event["summary"],
        start=event["start"],
        end=event["end"],
        description=event.get("description"),
    )
    return {"status": "created", "event": {"id": result.id, "summary": result.summary,
            "start": str(result.start), "end": str(result.end), "html_link": result.html_link}}
```

- [ ] **Step 2: main.py에 라우터 등록**

```python
from alma.api.integrations import router as integrations_router
app.include_router(integrations_router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/alma/api/integrations.py backend/src/alma/main.py
git commit -m "feat: add Integrations API router (OAuth + Calendar endpoints)"
```

---

### Task 8: IntegrationService 실제 구현

**Files:**
- Modify: `backend/src/alma/domain/integration/service.py`

- [ ] **Step 1: _execute_calendar_action 실제 구현으로 교체**

```python
# service.py 수정
# import 추가
from alma.domain.integration.repository import IntegrationRepository
from alma.domain.integration.calendar import GoogleCalendarProvider
from alma.domain.integration.crypto import decrypt_token

class IntegrationService:
    def __init__(self, session: AsyncSession, llm: LLMProvider):
        self.session = session
        self.llm = llm
        self.action_log_repo = ActionLogRepository(session)
        self.integration_repo = IntegrationRepository(session)

    # execute_action 시그니처 유지 (user_id는 이미 파라미터)
    async def execute_action(self, user_id: str, intent: ActionIntent) -> dict:
        result: dict = {}
        success = True
        try:
            if intent.service == "calendar":
                result = await self._execute_calendar_action(user_id, intent)
            elif intent.service == "notion":
                result = await self._execute_notion_action(user_id, intent)
            else:
                result = {"error": f"Unknown service: {intent.service}"}
                success = False
        except Exception as e:
            result = {"error": str(e)}
            success = False
        await self.action_log_repo.create(
            user_id=uuid.UUID(user_id), service=intent.service,
            action=intent.action, params=intent.params,
            result=result, success=success,
        )
        return result

    async def _execute_calendar_action(self, user_id: str, intent: ActionIntent) -> dict:
        integration = await self.integration_repo.get_active(
            uuid.UUID(user_id), "google_calendar"
        )
        if not integration:
            return {
                "error": "Google Calendar not connected",
                "connect_url": "/api/integrations/google/connect",
            }
        provider = GoogleCalendarProvider(integration, self.integration_repo)
        if intent.action == "create_event":
            from dataclasses import asdict
            event = await provider.create_event(**intent.params)
            return {"status": "created", "event": asdict(event)}
        elif intent.action == "list_events":
            from dataclasses import asdict
            events = await provider.list_events(**intent.params)
            return {"status": "ok", "events": [asdict(e) for e in events]}
        return {"error": f"Unknown action: {intent.action}"}

    async def _execute_notion_action(self, user_id: str, intent: ActionIntent) -> dict:
        return {
            "status": "action_ready",
            "service": "notion",
            "action": intent.action,
            "params": intent.params,
        }
```

- [ ] **Step 2: 기존 테스트 실행**

Run: `cd backend && python -m pytest -v`
Expected: ALL PASS (기존 + 새 테스트)

- [ ] **Step 3: Commit**

```bash
git add backend/src/alma/domain/integration/service.py
git commit -m "feat: implement real Google Calendar in IntegrationService"
```

---

### Task 9: 최종 검증

- [ ] **Step 1: Lint 체크**

Run: `cd backend && ruff check src/ tests/`

- [ ] **Step 2: 전체 테스트**

Run: `cd backend && python -m pytest -v`
Expected: ALL PASS

- [ ] **Step 3: CLAUDE.md + PROCESS.md 업데이트**

아키텍처에 integration 확장 반영:
```
  integration/            Bounded Context: 외부 연동 (확장)
    service.py              IntegrationService (실제 Calendar 연동)
    repository.py           ActionLogRepo + IntegrationRepo
    oauth.py                GoogleOAuthService
    calendar.py             GoogleCalendarProvider
    crypto.py               Fernet 토큰 암호화
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete Phase 3B Google Calendar integration"
```
