import { useEffect, useRef, useState, useCallback } from "react";

const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];
const MAX_RECONNECT_ATTEMPTS = RECONNECT_DELAYS_MS.length;

interface StreamHandlers {
  onChunk: (delta: string) => void;
  onDone: () => void;
  onCancelled: () => void;
  onError: (message: string) => void;
}

export function useChatWebSocket(
  conversationId: string,
  token: string,
  streamHandlers: StreamHandlers,
  onHabitReminder?: (message: string) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const unmountedRef = useRef(false);
  const manualCloseRef = useRef(false);
  const streamHandlersRef = useRef(streamHandlers);
  const onHabitReminderRef = useRef(onHabitReminder);

  // Keep refs fresh — avoids reconnection on handler identity changes
  useEffect(() => {
    streamHandlersRef.current = streamHandlers;
  }, [streamHandlers]);

  useEffect(() => {
    onHabitReminderRef.current = onHabitReminder;
  }, [onHabitReminder]);

  useEffect(() => {
    unmountedRef.current = false;
    manualCloseRef.current = false;
    attemptRef.current = 0;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = () => {
      if (unmountedRef.current) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      // WebSocket은 Next.js rewrites를 통하지 않으므로 백엔드에 직접 연결
      const wsHost = window.location.hostname + ":8000";
      const ws = new WebSocket(
        `${protocol}//${wsHost}/api/chat/ws/${conversationId}?token=${token}`
      );
      wsRef.current = ws;
      setIsConnecting(true);

      ws.onopen = () => {
        if (unmountedRef.current) return;
        attemptRef.current = 0;
        setReconnectAttempt(0);
        setIsConnected(true);
        setIsConnecting(false);
      };

      ws.onclose = (event) => {
        if (unmountedRef.current) return;
        setIsConnected(false);

        if (manualCloseRef.current) {
          setIsConnecting(false);
          return;
        }

        if (event.code === 4001) {
          setIsConnecting(false);
          return;
        }

        if (attemptRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_DELAYS_MS[attemptRef.current];
          attemptRef.current += 1;
          setReconnectAttempt(attemptRef.current);
          setIsConnecting(true);
          reconnectTimerRef.current = setTimeout(() => {
            if (!unmountedRef.current) connect();
          }, delay);
        } else {
          setIsConnecting(false);
        }
      };

      ws.onerror = (event) => {
        console.error("WebSocket 연결 오류:", event);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const type = data.type;

          if (type === "chunk") {
            streamHandlersRef.current.onChunk(data.content || "");
          } else if (type === "done") {
            streamHandlersRef.current.onDone();
          } else if (type === "cancelled") {
            // Append the cancellation marker as a final chunk then call onCancelled
            if (data.content) {
              streamHandlersRef.current.onChunk(data.content);
            }
            streamHandlersRef.current.onCancelled();
          } else if (type === "error") {
            streamHandlersRef.current.onError(
              data.content || "처리 중 오류가 발생했습니다."
            );
          } else if (type === "habit_reminder") {
            const key = `habit_reminder_shown_${new Date().toISOString().split("T")[0]}`;
            if (!sessionStorage.getItem(key)) {
              sessionStorage.setItem(key, "true");
              onHabitReminderRef.current?.(data.message);
            }
          } else if (type === "message") {
            // Legacy non-stream message (habit_reminder 외 레거시 호환)
            streamHandlersRef.current.onChunk(data.content || "");
            streamHandlersRef.current.onDone();
          }
        } catch (error) {
          console.error("WebSocket 메시지 파싱 실패:", error);
        }
      };
    };

    connect();

    return () => {
      unmountedRef.current = true;
      manualCloseRef.current = true;
      clearReconnectTimer();
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close();
      }
    };
  }, [conversationId, token]);

  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "message", content }));
  }, []);

  const cancelStream = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "cancel" }));
  }, []);

  const manualReconnect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    attemptRef.current = 0;
    setReconnectAttempt(0);
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }
  }, []);

  return {
    isConnected,
    isConnecting,
    reconnectAttempt,
    sendMessage,
    cancelStream,
    reconnect: manualReconnect,
  };
}
