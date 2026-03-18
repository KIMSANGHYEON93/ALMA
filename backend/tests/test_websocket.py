import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from alma.main import app


def test_websocket_rejects_without_token():
    """토큰 없이 WebSocket 연결 시 4001 코드로 거부."""
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/api/chat/ws/some-conv-id"):
            pass
    assert exc_info.value.code == 4001
    assert exc_info.value.reason == "Missing token"
