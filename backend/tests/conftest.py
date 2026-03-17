import os
from collections.abc import AsyncGenerator

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from alma.database import get_session
from alma.main import app
from alma.models.models import Base

TEST_DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://alma:alma@localhost:5433/alma_test"
)


@pytest.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:

        async def override_get_session():  # type: ignore[misc]
            yield session

        app.dependency_overrides[get_session] = override_get_session
        yield session
        await session.rollback()
        app.dependency_overrides.clear()
