import uuid
from datetime import datetime

from alma.core.events import event_bus
from alma.core.events.models import DomainEvent


async def emit(
    event_type: str,
    source: str,
    payload: dict,
    user_id: str | None = None,
    aggregate_id: str | None = None,
    trace_id: str | None = None,
) -> None:
    await event_bus.publish(
        DomainEvent(
            id=str(uuid.uuid4()),
            event_type=event_type,
            source=source,
            payload=payload,
            timestamp=datetime.utcnow(),
            user_id=user_id,
            aggregate_id=aggregate_id,
            trace_id=trace_id,
        )
    )
