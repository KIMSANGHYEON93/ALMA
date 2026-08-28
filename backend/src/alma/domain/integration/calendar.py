import asyncio
from dataclasses import dataclass

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from alma.config import settings
from alma.domain.integration.crypto import decrypt_token, encrypt_token


@dataclass
class CalendarEvent:
    id: str
    summary: str
    start: str
    end: str
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
            refresh_token=(
                decrypt_token(self.integration.refresh_token)
                if self.integration.refresh_token
                else None
            ),
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
        )

    def _build_service(self, credentials):
        return build("calendar", "v3", credentials=credentials)

    async def _refresh_token_if_needed(self) -> None:
        from datetime import datetime, timezone

        # token_expiry가 None이면 만료 여부 불명 → 재발급 시도 (첫 호출 케이스)
        if (
            self.integration.token_expiry
            and datetime.now(timezone.utc) < self.integration.token_expiry
        ):
            return

        if not self.integration.refresh_token:
            if self.integration_repo:
                await self.integration_repo.update_status(self.integration, "expired")
            raise RuntimeError("No refresh_token available — user must reconnect Google account")

        try:
            creds = self._get_credentials()

            def _refresh():
                from google.auth.transport.requests import Request

                creds.refresh(Request())
                return creds

            creds = await asyncio.to_thread(_refresh)
            if not creds.token:
                raise RuntimeError("Google OAuth refresh returned no access token")
            new_access = encrypt_token(creds.token)

            # DB에 새 토큰 명시적으로 영속화 (다음 요청에서 재사용 가능)
            if self.integration_repo:
                await self.integration_repo.update_tokens(
                    self.integration,
                    access_token=new_access,
                    token_expiry=creds.expiry,
                    status="active",
                )
            else:
                # 레포 없으면 메모리만 업데이트
                self.integration.access_token = new_access
                self.integration.token_expiry = creds.expiry
        except Exception:
            if self.integration_repo:
                await self.integration_repo.update_status(self.integration, "expired")
            raise

    async def list_events(
        self, time_min: str, time_max: str, max_results: int = 10
    ) -> list[CalendarEvent]:
        await self._refresh_token_if_needed()
        creds = self._get_credentials()

        def _list():
            service = self._build_service(creds)
            result = (
                service.events()
                .list(
                    calendarId="primary",
                    timeMin=time_min,
                    timeMax=time_max,
                    maxResults=max_results,
                    singleEvents=True,
                    orderBy="startTime",
                )
                .execute()
            )
            return result.get("items", [])

        items = await asyncio.to_thread(_list)
        return [self._parse_event(item) for item in items]

    async def create_event(
        self,
        summary: str,
        start: str,
        end: str,
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
            return service.events().insert(calendarId="primary", body=event_body).execute()

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
