import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from alma.domain.identity.service import decode_token
from alma.database import async_session
from alma.api.llm import create_llm_router
from alma.config import settings
from alma.domain.chat.service import ChatService
from alma.domain.growth.service import GoalService
from alma.domain.habit.service import HabitService
from alma.domain.knowledge.service import KnowledgeService
from alma.domain.memory.embedding import create_embedding_provider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.websocket("/ws/{conversation_id}")
async def websocket_chat(websocket: WebSocket, conversation_id: str):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        payload = decode_token(token)
        user_id = payload["sub"]
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await websocket.accept()

    async with async_session() as session:
        llm_router = create_llm_router()
        goal_service = GoalService(session)
        habit_service = HabitService(session)
        embedding_provider = create_embedding_provider(settings)
        knowledge_service = KnowledgeService(session, embedding_provider)
        chat_service = ChatService(
            session=session,
            llm=llm_router,
            goal_service=goal_service,
            habit_service=habit_service,
            knowledge_service=knowledge_service,
        )

        # 접속 시 미완료 습관 리마인더
        try:
            import uuid as uuid_mod

            summary = await habit_service.get_today_summary(uuid_mod.UUID(user_id))
            uncompleted = [
                h for h in summary["habits"] if h["scheduled_today"] and not h["completed"]
            ]
            if uncompleted:
                names = "\n".join(f"⬜ {h['title']}" for h in uncompleted)
                reminder_msg = (
                    f"오늘 아직 완료하지 않은 습관이 있어요:\n{names}\n"
                    f"완료: {summary['completed']}/{summary['total']}"
                )
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "habit_reminder",
                            "message": reminder_msg,
                        }
                    )
                )
        except Exception:
            logger.warning("Failed to send habit reminder", exc_info=True)

        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                content = message.get("content", "")

                try:
                    response = await chat_service.process_message(
                        user_id=user_id,
                        conversation_id=conversation_id,
                        content=content,
                    )
                    await websocket.send_text(json.dumps({"type": "message", "content": response}))
                except Exception:
                    logger.exception("Chat processing error")
                    await websocket.send_text(
                        json.dumps({"type": "error", "content": "처리 중 오류가 발생했습니다."})
                    )
        except WebSocketDisconnect:
            pass
