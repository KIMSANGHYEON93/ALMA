# backend/src/alma/domain/habit/models.py
from enum import Enum


class FrequencyType(str, Enum):
    DAILY = "daily"
    SPECIFIC_DAYS = "specific_days"
    TIMES_PER_WEEK = "times_per_week"
    EVERY_N_DAYS = "every_n_days"


class HabitStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


class CheckinSource(str, Enum):
    UI = "ui"
    CHAT = "chat"
