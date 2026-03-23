from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from alma.api.auth import router as auth_router
from alma.api.chat import router as chat_router
from alma.api.conversations import router as conversations_router
from alma.api.goals import router as goals_router
from alma.api.habit_analytics import router as habit_analytics_router
from alma.api.habits import router as habits_router
from alma.api.insights import router as insights_router
from alma.api.integrations import router as integrations_router
from alma.api.messages import router as messages_router
from alma.api.profile import router as profile_router
from alma.core.events import event_bus
from alma.core.events.store import EventStoreHandler
from alma.database import async_session


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[no-untyped-def]
    yield


app = FastAPI(title="ALMA", version="0.1.0", lifespan=lifespan, redirect_slashes=False)

# EventStore: 모든 이벤트를 DB에 저장
event_store_handler = EventStoreHandler(async_session)
event_bus.subscribe_all(event_store_handler.handle)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(conversations_router)
app.include_router(chat_router)
app.include_router(messages_router)
app.include_router(profile_router)
app.include_router(goals_router)
app.include_router(habits_router)
app.include_router(habit_analytics_router)
app.include_router(insights_router)
app.include_router(integrations_router)
