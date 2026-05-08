from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from alma.auth.dependencies import get_current_user
from alma.config import settings
from alma.database import get_session
from alma.domain.integration.crypto import decrypt_token, encrypt_token
from alma.domain.integration.repository import IntegrationRepository
from alma.models.models import User

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
            id=str(i.id),
            provider=i.provider,
            status=i.status,
            created_at=i.created_at.isoformat(),
        )
        for i in integrations
    ]


@router.post("/google/connect", response_model=AuthUrlResponse)
async def connect_google(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    # 사용자 설정에서 먼저 확인, 없으면 글로벌 설정 사용
    from alma.domain.identity.profile import UserProfileService

    profile = UserProfileService(session)
    prefs = await profile.get_preferences(str(user.id))

    client_id = prefs.get("google_client_id") or settings.google_client_id
    client_secret = prefs.get("google_client_secret") or settings.google_client_secret

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth not configured. Please set Client ID and Secret in Settings.",
        )

    from alma.domain.integration.oauth import GoogleOAuthService

    auth_url, nonce = GoogleOAuthService.generate_auth_url(
        str(user.id), client_id=client_id, client_secret=client_secret
    )
    # Store pending integration with nonce in access_token field temporarily
    repo = IntegrationRepository(session)
    await repo.create_or_update(
        user_id=user.id,
        provider="google_calendar",
        access_token=encrypt_token(nonce),
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
    if error:
        return RedirectResponse(url="http://localhost:3000/settings?integration=denied")

    if not code or not state:
        return RedirectResponse(
            url="http://localhost:3000/settings?integration=error&reason=missing_params"
        )

    # Verify state JWT
    from alma.domain.integration.oauth import GoogleOAuthService

    try:
        payload = GoogleOAuthService.verify_state(state)
        user_id = payload["user_id"]
    except Exception:
        return RedirectResponse(
            url="http://localhost:3000/settings?integration=error&reason=invalid_state"
        )

    # Get user's Google OAuth credentials from preferences
    import uuid

    from alma.domain.identity.profile import UserProfileService

    profile = UserProfileService(session)
    prefs = await profile.get_preferences(user_id)
    client_id = prefs.get("google_client_id") or settings.google_client_id
    client_secret = prefs.get("google_client_secret") or settings.google_client_secret

    # Retrieve code_verifier from pending integration
    repo = IntegrationRepository(session)
    pending = await repo.get_active(
        uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
        "google_calendar",
    )
    code_verifier = None
    if not pending:
        # Try pending status
        from sqlalchemy import select
        from alma.models.models import Integration

        result = await session.execute(
            select(Integration).where(
                Integration.user_id
                == (uuid.UUID(user_id) if isinstance(user_id, str) else user_id),
                Integration.provider == "google_calendar",
                Integration.status == "pending",
            )
        )
        pending = result.scalar_one_or_none()
    if pending:
        try:
            code_verifier = decrypt_token(pending.access_token)
        except Exception:
            pass

    # Exchange code for tokens
    try:
        tokens = GoogleOAuthService.exchange_code(
            code,
            client_id=client_id,
            client_secret=client_secret,
            code_verifier=code_verifier,
        )
    except Exception as e:
        import logging

        logging.getLogger(__name__).exception("Google token exchange failed")
        import urllib.parse

        error_msg = urllib.parse.quote(str(e)[:200])
        return RedirectResponse(
            url=f"http://localhost:3000/settings?integration=error&reason=token_exchange&detail={error_msg}"
        )

    # Store encrypted tokens
    repo = IntegrationRepository(session)
    await repo.create_or_update(
        user_id=uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
        provider="google_calendar",
        access_token=encrypt_token(tokens["access_token"]),
        refresh_token=(
            encrypt_token(tokens["refresh_token"]) if tokens.get("refresh_token") else None
        ),
        token_expiry=tokens.get("expiry"),
        scopes="calendar.events",
        status="active",
    )

    return RedirectResponse(url="http://localhost:3000/settings?integration=connected")


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

    # Best-effort Google token revoke
    try:
        import httpx

        token = decrypt_token(integration.access_token)
        async with httpx.AsyncClient() as client:
            await client.post("https://oauth2.googleapis.com/revoke", params={"token": token})
    except Exception:
        pass

    await repo.delete(integration.id)


@router.get("/google/calendar/events")
async def list_calendar_events(
    period: str = Query(default="today", pattern="^(today|week)$"),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    repo = IntegrationRepository(session)
    integration = await repo.get_active(user.id, "google_calendar")
    if not integration:
        raise HTTPException(status_code=404, detail="Google Calendar not connected")

    from alma.domain.integration.calendar import GoogleCalendarProvider

    provider = GoogleCalendarProvider(integration, repo)

    now = datetime.utcnow()
    if period == "today":
        time_min = now.replace(hour=0, minute=0, second=0).isoformat() + "Z"
        time_max = now.replace(hour=23, minute=59, second=59).isoformat() + "Z"
    else:
        time_min = now.isoformat() + "Z"
        time_max = (now + timedelta(days=7)).isoformat() + "Z"

    events = await provider.list_events(time_min, time_max)
    return [
        {
            "id": e.id,
            "summary": e.summary,
            "start": e.start,
            "end": e.end,
            "timezone": e.timezone,
        }
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
    return {
        "status": "created",
        "event": {
            "id": result.id,
            "summary": result.summary,
            "start": result.start,
            "end": result.end,
            "html_link": result.html_link,
        },
    }
