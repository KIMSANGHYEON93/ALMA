from enum import Enum


class GoalStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    PAUSED = "paused"
    ABANDONED = "abandoned"


class GoalCategory(str, Enum):
    PERSONAL = "personal"
    CAREER = "career"
    HEALTH = "health"
    LEARNING = "learning"
    FINANCE = "finance"
    OTHER = "other"
