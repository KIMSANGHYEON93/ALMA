import uuid
from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class DomainEvent:
    event_type: str
    source: str
    payload: dict
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)
    aggregate_id: str | None = None
    user_id: str | None = None
    trace_id: str | None = None
