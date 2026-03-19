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
        from datetime import datetime

        if (
            self.integration.token_expiry
            and datetime.utcnow() < self.integration.token_expiry
        ):
            return
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
        self, summary: str, start: str, end: str, description: str | None = None
    ) -> CalendarEvent:
        await self._refresh_token_if_needed()
        creds = self._get_credentials()

        event_body: dict = {
            "summary": summary,
            "start": {"dateTime": start},
            "end": {"dateTime": end},
        }
        if description:
            event_body["description"] = description

        def _create():
            service = self._build_service(creds)
            return (
                service.events()
                .insert(calendarId="primary", body=event_body)
                .execute()
            )

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
