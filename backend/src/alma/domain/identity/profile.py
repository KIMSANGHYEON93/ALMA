import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from alma.domain.identity.repository import UserRepository
from alma.domain.identity.secure_prefs import decrypt_sensitive, encrypt_sensitive, mask_sensitive

DEFAULT_PREFERENCES = {
    "language": "ko",
    "response_style": "concise",
    "interests": [],
    "timezone": "Asia/Seoul",
    "llm_model": "claude",
    "learned": {},
}


class UserProfileService:
    def __init__(self, session: AsyncSession):
        self.user_repo = UserRepository(session)
        self.session = session

    async def get_preferences(self, user_id: str) -> dict:
        """Get preferences with sensitive fields MASKED (for API response)"""
        user = await self.user_repo.find_by_id(uuid.UUID(user_id))
        if not user:
            return dict(DEFAULT_PREFERENCES)
        merged = dict(DEFAULT_PREFERENCES)
        merged.update(user.preferences or {})
        return mask_sensitive(merged)

    async def get_decrypted_preferences(self, user_id: str) -> dict:
        """Get preferences with sensitive fields DECRYPTED (for internal use)"""
        user = await self.user_repo.find_by_id(uuid.UUID(user_id))
        if not user:
            return dict(DEFAULT_PREFERENCES)
        merged = dict(DEFAULT_PREFERENCES)
        merged.update(user.preferences or {})
        return decrypt_sensitive(merged)

    async def update_preferences(self, user_id: str, prefs: dict) -> dict:
        user = await self.user_repo.find_by_id(uuid.UUID(user_id))
        if not user:
            raise ValueError("User not found")
        current = dict(user.preferences or {})
        prefs.pop("learned", None)
        # Encrypt sensitive fields before saving
        encrypted = encrypt_sensitive(prefs)
        current.update(encrypted)
        user.preferences = current
        await self.session.commit()
        await self.session.refresh(user)
        merged = dict(DEFAULT_PREFERENCES)
        merged.update(user.preferences)
        return mask_sensitive(merged)
