# backend/src/alma/domain/automation/handler.py
from alma.core.events.models import DomainEvent
from alma.domain.automation.service import AutomationService


class AutomationEventHandler:
    """이벤트 버스 글로벌 핸들러: 이벤트 -> 자동화 규칙 매칭/실행"""

    def __init__(self, session_factory):
        self.session_factory = session_factory

    async def handle(self, event: DomainEvent) -> None:
        # automation 자체 이벤트는 무한 루프 방지
        if event.source == "automation":
            return
        async with self.session_factory() as session:
            service = AutomationService(session)
            await service.handle_event(event)
