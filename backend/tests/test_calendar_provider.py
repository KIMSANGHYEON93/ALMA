from alma.domain.integration.calendar import CalendarEvent, GoogleCalendarProvider


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
    assert event.start == "2026-03-20T15:00:00+09:00"


def test_parse_event_date_only():
    item = {
        "id": "evt-2",
        "summary": "All Day Event",
        "start": {"date": "2026-03-20"},
        "end": {"date": "2026-03-21"},
    }
    event = GoogleCalendarProvider._parse_event(item)
    assert event.start == "2026-03-20"
    assert event.end == "2026-03-21"
    assert event.timezone is None


def test_calendar_event_dataclass():
    event = CalendarEvent(
        id="1",
        summary="Test",
        start="2026-03-20T10:00:00",
        end="2026-03-20T11:00:00",
        timezone="UTC",
    )
    assert event.summary == "Test"
    assert event.timezone == "UTC"
    assert event.description is None


def test_parse_event_missing_fields():
    item = {}
    event = GoogleCalendarProvider._parse_event(item)
    assert event.id == ""
    assert event.summary == ""
    assert event.start == ""
