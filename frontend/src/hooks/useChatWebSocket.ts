import { useEffect, useRef, useState, useCallback } from "react";

export function useChatWebSocket(
  conversationId: string,
  token: string,
  onMessage: (content: string, id?: string) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);

  // onMessage 콜백을 ref로 유지하여 WebSocket 재연결 방지
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const ws = new WebSocket(
      `${protocol}//${host}/api/chat/ws/${conversationId}?token=${token}`
    );

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onerror = (event) => {
      console.error("WebSocket 연결 오류:", event);
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "message") {
          onMessageRef.current(data.content, data.id);
        }
      } catch (error) {
        console.error("WebSocket 메시지 파싱 실패:", error);
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  }, [conversationId, token]);

  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ content }));
  }, []);

  return { isConnected, sendMessage };
}
