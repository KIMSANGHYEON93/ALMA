import { useEffect, useRef, useState, useCallback } from "react";

export function useChatWebSocket(
  conversationId: string,
  token: string,
  onMessage: (content: string, id?: string) => void,
  onHabitReminder?: (message: string) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const onHabitReminderRef = useRef(onHabitReminder);

  // onMessage 콜백을 ref로 유지하여 WebSocket 재연결 방지
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onHabitReminderRef.current = onHabitReminder;
  }, [onHabitReminder]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // WebSocket은 Next.js rewrites를 통하지 않으므로 백엔드에 직접 연결
    const wsHost = window.location.hostname + ":8000";
    const ws = new WebSocket(
      `${protocol}//${wsHost}/api/chat/ws/${conversationId}?token=${token}`
    );

    ws.onopen = () => { setIsConnected(true); setIsConnecting(false); };
    ws.onclose = () => { setIsConnected(false); setIsConnecting(false); };
    ws.onerror = (event) => {
      console.error("WebSocket 연결 오류:", event);
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "message") {
          onMessageRef.current(data.content, data.id);
        } else if (data.type === "habit_reminder") {
          const key = `habit_reminder_shown_${new Date().toISOString().split("T")[0]}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "true");
            onHabitReminderRef.current?.(data.message);
          }
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

  return { isConnected, isConnecting, sendMessage };
}
