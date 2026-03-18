import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.identity.repository import UserRepository

DEFAULT_PREFERENCES = {
    "language": "ko",
    "response_style": "concise",
    "interests": [],
    "timezone": "Asia/Seoul",
    "learned": {},
}


class UserProfileService:
    def __init__(self, session: AsyncSession):
        self.user_repo = UserRepository(session)
        self.session = session

    async def get_preferences(self, user_id: str) -> dict:
        user = await self.user_repo.find_by_id(uuid.UUID(user_id))
        if not user:
            return dict(DEFAULT_PREFERENCES)
        merged = dict(DEFAULT_PREFERENCES)
        merged.update(user.preferences or {})
        return merged

    async def update_preferences(self, user_id: str, prefs: dict) -> dict:
        user = await self.user_repo.find_by_id(uuid.UUID(user_id))
        if not user:
            raise ValueError("User not found")
        current = dict(user.preferences or {})
        prefs.pop("learned", None)
        current.update(prefs)
        user.preferences = current
        await self.session.commit()
        await self.session.refresh(user)
        merged = dict(DEFAULT_PREFERENCES)
        merged.update(user.preferences)
        return merged
