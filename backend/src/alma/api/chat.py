import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from alma.api.llm import create_llm_router
from alma.config import settings
from alma.database import async_session
from alma.domain.chat.service import ChatService
from alma.domain.growth.service import GoalService
from alma.domain.habit.service import HabitService
from alma.domain.identity.profile import UserProfileService
from alma.domain.identity.service import decode_token
from alma.domain.knowledge.service import KnowledgeService
from alma.domain.memory.embedding import create_embedding_provider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


async def _safe_send(websocket: WebSocket, payload: dict) -> bool:
    """WS 연결 상태 확인 후 안전하게 전송. 성공 시 True."""
    if websocket.client_state != WebSocketState.CONNECTED:
        return False
    try:
        await websocket.send_text(json.dumps(payload))
        return True
    except (WebSocketDisconnect, RuntimeError):
        logger.info("Client disconnected during send")
        return False


async def _run_stream(
    websocket: WebSocket,
    chat_service: ChatService,
    user_id: str,
    conversation_id: str,
    content: str,
) -> None:
    """ChatService 스트림을 소비해 WS 청크 이벤트로 변환 전송."""
    try:
        async for event in chat_service.process_message_stream(
            user_id=user_id,
            conversation_id=conversation_id,
            content=content,
        ):
            if websocket.client_state != WebSocketState.CONNECTED:
                logger.info("WS closed mid-stream, aborting")
                return

            etype = event.get("type")
            if etype == "chunk":
                sent = await _safe_send(
                    websocket, {"type": "chunk", "content": event.get("content", "")}
                )
                if not sent:
                    return
            elif etype == "action_result":
                sent = await _safe_send(
                    websocket, {"type": "chunk", "content": event.get("content", "")}
                )
                if not sent:
                    return
            elif etype == "done":
                await _safe_send(websocket, {"type": "done"})
                return
    except asyncio.CancelledError:
        logger.info("Chat stream cancelled by user")
        await _safe_send(
            websocket,
            {"type": "cancelled", "content": "\n\n_[응답이 취소되었습니다]_"},
        )
        raise
    except Exception:
        logger.exception("Chat processing error")
        await _safe_send(
            websocket,
            {"type": "error", "content": "처리 중 오류가 발생했습니다."},
        )


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
        # Get user's decrypted preferences for API keys
        profile_service = UserProfileService(session)
        user_prefs = await profile_service.get_decrypted_preferences(user_id)

        llm_router = create_llm_router(user_prefs=user_prefs)
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
                await _safe_send(
                    websocket, {"type": "habit_reminder", "message": reminder_msg}
                )
        except Exception:
            logger.warning("Failed to send habit reminder", exc_info=True)

        active_stream: asyncio.Task | None = None

        try:
            while True:
                data = await websocket.receive_text()
                try:
                    message = json.loads(data)
                except json.JSONDecodeError:
                    await _safe_send(
                        websocket,
                        {"type": "error", "content": "잘못된 메시지 형식입니다."},
                    )
                    continue

                msg_type = message.get("type", "message")

                # 취소 명령 처리 — 진행 중인 스트림이 있으면 취소
                if msg_type == "cancel":
                    if active_stream and not active_stream.done():
                        active_stream.cancel()
                    continue

                content = message.get("content", "")
                if not content.strip():
                    continue

                # 이전 스트림이 아직 진행 중이면 먼저 취소하고 대기
                if active_stream and not active_stream.done():
                    active_stream.cancel()
                    try:
                        await active_stream
                    except (asyncio.CancelledError, Exception):
                        pass

                # 새 스트림을 백그라운드 태스크로 시작 → receive 루프는 계속 cancel 수신 가능
                active_stream = asyncio.create_task(
                    _run_stream(
                        websocket,
                        chat_service,
                        user_id,
                        conversation_id,
                        content,
                    )
                )
        except WebSocketDisconnect:
            logger.info("WS client disconnected")
        finally:
            if active_stream and not active_stream.done():
                active_stream.cancel()
                try:
                    await active_stream
                except (asyncio.CancelledError, Exception):
                    pass
