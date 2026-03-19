from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from alma.api.auth import router as auth_router
from alma.api.chat import router as chat_router
from alma.api.conversations import router as conversations_router
from alma.api.messages import router as messages_router
from alma.api.goals import router as goals_router
from alma.api.profile import router as profile_router


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[no-untyped-def]
    yield


app = FastAPI(title="ALMA", version="0.1.0", lifespan=lifespan, redirect_slashes=False)
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
