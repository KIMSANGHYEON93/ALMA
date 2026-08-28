from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from alma.api.auth import router as auth_router
from alma.api.chat_rest import router as chat_rest_router
from alma.api.chat import router as chat_router
from alma.api.conversations import router as conversations_router
from alma.api.goals import router as goals_router
from alma.api.habit_analytics import router as habit_analytics_router
from alma.api.habits import router as habits_router
from alma.api.insights import router as insights_router
from alma.api.automations import router as automations_router
from alma.api.integrations import router as integrations_router
from alma.api.knowledge import router as knowledge_router
from alma.api.llm import router as llm_router
from alma.api.notifications import router as notifications_router
from alma.api.ontology import router as ontology_router
from alma.api.ontology_automations import router as ontology_automations_router
from alma.api.ontology_import import router as ontology_import_router
from alma.api.ontology_insights import router as ontology_insights_router
from alma.gateway.discord_bot import router as discord_router
from alma.gateway.telegram import router as telegram_router
from alma.api.messages import router as messages_router
from alma.api.profile import router as profile_router
from alma.core.events import event_bus
from alma.core.events.store import EventStoreHandler
from alma.database import async_session
from alma.domain.automation.handler import AutomationEventHandler


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="VIVARA", version="0.1.0", lifespan=lifespan, redirect_slashes=False)


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


# EventStore: 모든 이벤트를 DB에 저장
event_store_handler = EventStoreHandler(async_session)
event_bus.subscribe_all(event_store_handler.handle)

# AutomationEventHandler: 이벤트 기반 자동화 규칙 실행
automation_handler = AutomationEventHandler(async_session)
event_bus.subscribe_all(automation_handler.handle)

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
app.include_router(automations_router)
app.include_router(knowledge_router)
app.include_router(llm_router)
app.include_router(chat_rest_router)
app.include_router(telegram_router)
app.include_router(notifications_router)
app.include_router(ontology_router)
app.include_router(ontology_import_router)
app.include_router(ontology_insights_router)
app.include_router(ontology_automations_router)
app.include_router(discord_router)

# Ontology adapters (lazy initialization per event)


async def _ontology_adapter_handler(event):
    """Lazy adapter handler: creates session per event."""
    import logging

    from alma.domain.ontology.adapters.goal_adapter import GoalAdapter
    from alma.domain.ontology.adapters.habit_adapter import HabitAdapter
    from alma.domain.ontology.adapters.memory_adapter import MemoryAdapter
    from alma.domain.ontology.dedup import DeduplicationService
    from alma.domain.ontology.pipeline import PurificationPipeline
    from alma.domain.ontology.service import OntologyService
    from alma.domain.ontology.validator import SchemaValidator

    async with async_session() as session:
        service = OntologyService(session, embedding_provider=None)
        pipeline = PurificationPipeline(DeduplicationService(session), SchemaValidator(), service)

        # Chat/Knowledge adapters require SemanticExtractor with LLMRouter
        if event.event_type in ("message.received", "knowledge.document_ready"):
            llm_router = None
            try:
                from alma.config import settings
                from alma.infrastructure.llm.router import LLMRouter

                providers: dict = {}
                if settings.anthropic_api_key:
                    from alma.infrastructure.llm.claude import ClaudeProvider

                    providers["claude"] = ClaudeProvider()
                if settings.openai_api_key:
                    from alma.infrastructure.llm.openai_provider import OpenAIProvider

                    providers["openai"] = OpenAIProvider()
                if providers:
                    llm_router = LLMRouter(providers)
            except Exception:
                pass

            if llm_router:
                from alma.domain.ontology.adapters.chat_adapter import ChatAdapter
                from alma.domain.ontology.adapters.knowledge_adapter import KnowledgeAdapter
                from alma.domain.ontology.extractor import SemanticExtractor

                extractor = SemanticExtractor(llm_router, service)

                ontology_adapter: ChatAdapter | KnowledgeAdapter
                if event.event_type == "message.received":
                    ontology_adapter = ChatAdapter(extractor, pipeline)
                else:
                    ontology_adapter = KnowledgeAdapter(extractor, pipeline)

                try:
                    await ontology_adapter.handle(event)
                    await session.commit()
                except Exception:
                    await session.rollback()
                    logging.getLogger(__name__).warning(
                        "Ontology adapter failed for %s", event.event_type, exc_info=True
                    )
            return

        adapters = {
            "goal.created": GoalAdapter(pipeline, service),
            "goal.updated": GoalAdapter(pipeline, service),
            "goal.deleted": GoalAdapter(pipeline, service),
            "habit.created": HabitAdapter(pipeline, service),
            "habit.deleted": HabitAdapter(pipeline, service),
            "memory.created": MemoryAdapter(pipeline, service),
        }
        adapter = adapters.get(event.event_type)
        if adapter:
            try:
                await adapter.handle(event)
                await session.commit()
            except Exception:
                await session.rollback()
                logging.getLogger(__name__).warning(
                    "Ontology adapter failed for %s", event.event_type, exc_info=True
                )


for _evt in [
    "goal.created",
    "goal.updated",
    "goal.deleted",
    "habit.created",
    "habit.deleted",
    "memory.created",
    "message.received",
    "knowledge.document_ready",
]:
    event_bus.subscribe(_evt, _ontology_adapter_handler)
