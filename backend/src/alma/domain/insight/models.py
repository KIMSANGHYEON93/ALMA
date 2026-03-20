from enum import Enum


class InsightCategory(str, Enum):
    TOPIC_TREND = "topic_trend"
    GOAL_PATTERN = "goal_pattern"
    ACTIVITY_PATTERN = "activity_pattern"
    RECOMMENDATION = "recommendation"
