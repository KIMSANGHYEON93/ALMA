import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from alma.domain.identity.service import decode_token
from alma.database import async_session
from alma.infrastructure.llm.claude import ClaudeProvider
from alma.domain.chat.service import ChatService

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
        llm = ClaudeProvider()
        chat_service = ChatService(session=session, llm=llm)

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
