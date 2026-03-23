import logging
from collections.abc import Callable

from alma.core.events.models import DomainEvent

logger = logging.getLogger(__name__)


class InMemoryEventBus:
    def __init__(self):
        self._handlers: dict[str, list[Callable]] = {}
        self._global_handlers: list[Callable] = []

    async def publish(self, event: DomainEvent) -> None:
        for handler in self._handlers.get(event.event_type, []):
            try:
                await handler(event)
            except Exception:
                logger.warning("Handler failed for %s", event.event_type, exc_info=True)
        for handler in self._global_handlers:
            try:
                await handler(event)
            except Exception:
                logger.warning("Global handler failed", exc_info=True)

    def subscribe(self, event_type: str, handler: Callable) -> None:
        self._handlers.setdefault(event_type, []).append(handler)

    def subscribe_all(self, handler: Callable) -> None:
        self._global_handlers.append(handler)
