"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import { apiClient } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface MessagesPageResponse {
  messages: {
    id: string;
    role: string;
    content: string;
    created_at: string;
  }[];
  has_more: boolean;
}

interface ChatWindowProps {
  token: string;
  conversationId: string;
}

export default function ChatWindow({
  token,
  conversationId,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  // conversationId 변경 시 히스토리 로드
  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      setMessages([]);
      setHasMore(false);

      try {
        const data = await apiClient<MessagesPageResponse>(
          `/api/conversations/${conversationId}/messages?limit=20`,
          { token }
        );

        if (cancelled) return;

        setMessages(
          data.messages.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
          }))
        );
        setHasMore(data.has_more);
        shouldAutoScroll.current = true;
      } catch (error) {
        if (!cancelled) {
          console.error("히스토리 로드 실패:", error);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [conversationId, token]);

  // 이전 메시지 추가 로드 (무한 스크롤)
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || messages.length === 0) return;

    setIsLoadingMore(true);

    const container = scrollContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;

    try {
      const oldestId = messages[0].id;
      const data = await apiClient<MessagesPageResponse>(
        `/api/conversations/${conversationId}/messages?limit=20&before=${oldestId}`,
        { token }
      );

      setMessages((prev) => [
        ...data.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        ...prev,
      ]);
      setHasMore(data.has_more);

      // 스크롤 위치 복원: 새 메시지가 위에 추가된 만큼 스크롤 유지
      requestAnimationFrame(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - prevScrollHeight;
        }
      });
    } catch (error) {
      console.error("이전 메시지 로드 실패:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, messages, conversationId, token]);

  // IntersectionObserver로 상단 스크롤 감지
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      {
        root: scrollContainerRef.current,
        threshold: 0.1,
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  // WebSocket 연결
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const ws = new WebSocket(
      `${protocol}//${host}/api/chat/ws/${conversationId}?token=${token}`
    );

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "message") {
        setMessages((prev) => [
          ...prev,
          {
            id: data.id ?? "",
            role: "assistant",
            content: data.content,
          },
        ]);
        shouldAutoScroll.current = true;
      }
    };

    wsRef.current = ws;
    return () => ws.close();
  }, [conversationId, token]);

  // 새 메시지 시 하단으로 자동 스크롤
  useEffect(() => {
    if (shouldAutoScroll.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      shouldAutoScroll.current = false;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current) return;

    setMessages((prev) => [
      ...prev,
      { id: "", role: "user", content: input },
    ]);
    wsRef.current.send(JSON.stringify({ content: input }));
    setInput("");
    shouldAutoScroll.current = true;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b dark:border-gray-800">
        <h2 className="font-semibold">ALMA</h2>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            isConnected
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {isConnected ? "연결됨" : "연결 끊김"}
        </span>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-6 space-y-4"
      >
        {/* 무한 스크롤 감지 영역 */}
        <div ref={loadMoreRef} className="h-1" aria-hidden="true" />

        {/* 이전 메시지 로딩 스피너 */}
        {isLoadingMore && (
          <div className="flex justify-center py-2" role="status">
            <svg
              className="animate-spin h-5 w-5 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-label="이전 메시지 로드 중"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="sr-only">이전 메시지 로드 중</span>
          </div>
        )}

        {/* 히스토리 최초 로딩 스피너 */}
        {isLoadingHistory && (
          <div className="flex justify-center items-center py-12" role="status">
            <svg
              className="animate-spin h-8 w-8 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-label="대화 히스토리 로드 중"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="sr-only">대화 히스토리 로드 중</span>
          </div>
        )}

        {/* 메시지 목록 */}
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id || `ws-${i}`}
            role={msg.role}
            content={msg.content}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t dark:border-gray-800">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            rows={1}
            className="flex-1 px-4 py-2 border rounded-lg resize-none dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={!isConnected || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}
