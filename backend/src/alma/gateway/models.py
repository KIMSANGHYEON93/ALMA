from dataclasses import dataclass, field


@dataclass(frozen=True)
class UnifiedMessage:
    channel: str
    user_id: str
    content: str
    conversation_id: str | None = None
    metadata: dict = field(default_factory=dict)


@dataclass(frozen=True)
class UnifiedResponse:
    content: str
    conversation_id: str
    metadata: dict = field(default_factory=dict)
