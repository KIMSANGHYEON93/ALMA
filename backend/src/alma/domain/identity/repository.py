import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from alma.models.models import User


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, email: str, password_hash: str, display_name: str | None = None) -> User:
        user = User(email=email, password_hash=password_hash, display_name=display_name)
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def find_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def find_by_email(self, email: str) -> User | None:
        result = await self.session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()
