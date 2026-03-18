import os
from collections.abc import AsyncGenerator

import pytest
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from alma.database import get_session
from alma.main import app
from alma.models.models import Base

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    os.getenv("DATABASE_URL", "postgresql+asyncpg://alma:alma@localhost:5433/alma_test"),
)


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
    )
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)

    async with engine.connect() as conn:
        trans = await conn.begin()
        await conn.begin_nested()

        session = AsyncSession(bind=conn, expire_on_commit=False)

        # Restart SAVEPOINT after each commit inside tests
        @event.listens_for(session.sync_session, "after_transaction_end")
        def restart_savepoint(session_sync, transaction):  # type: ignore[no-untyped-def]
            if transaction.nested and not transaction._parent.nested:
                session_sync.begin_nested()

        async def override_get_session():  # type: ignore[misc]
            yield session

        app.dependency_overrides[get_session] = override_get_session
        yield session
        app.dependency_overrides.clear()

        await trans.rollback()

    await engine.dispose()
