"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import Spinner from "./common/Spinner";
import ActiveGoalsBanner from "./ActiveGoalsBanner";
import { useMessages } from "@/hooks/useMessages";
import { useChatWebSocket } from "@/hooks/useChatWebSocket";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

interface ChatWindowProps {
  token: string;
  conversationId: string;
}

export default function ChatWindow({
  token,
  conversationId,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    hasMore,
    isLoadingHistory,
    isLoadingMore,
    loadHistory,
    loadMore,
    addMessage,
  } = useMessages(conversationId, token, scrollContainerRef);

  const handleWsMessage = useCallback(
    (content: string, id?: string) => {
      addMessage({ id: id ?? "", role: "assistant", content });
      shouldAutoScroll.current = true;
    },
    [addMessage]
  );

  const { isConnected, isConnecting, sendMessage: wsSend } = useChatWebSocket(
    conversationId,
    token,
    handleWsMessage
  );

  const { loadMoreRef } = useInfiniteScroll(
    loadMore,
    hasMore && !isLoadingMore,
    scrollContainerRef
  );

  // conversationId 변경 시 히스토리 로드
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      await loadHistory();
      if (!cancelled) {
        shouldAutoScroll.current = true;
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [loadHistory]);

  // 새 메시지 시 하단으로 자동 스크롤
  useEffect(() => {
    if (shouldAutoScroll.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      shouldAutoScroll.current = false;
    }
  }, [messages]);

  const MAX_LENGTH = 2000;

  const sendMessage = () => {
    if (!input.trim() || input.length > MAX_LENGTH) return;

    addMessage({ id: "", role: "user", content: input });
    wsSend(input);
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
      <ActiveGoalsBanner />
      <div className="flex items-center justify-between px-6 py-3 border-b dark:border-gray-800">
        <h2 className="font-semibold">ALMA</h2>
        <span
          role="status"
          className={`text-xs px-2 py-1 rounded-full ${
            isConnecting
              ? "bg-yellow-100 text-yellow-700"
              : isConnected
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
          }`}
        >
          {isConnecting ? "연결 중..." : isConnected ? "연결됨" : "연결 끊김"}
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
          <div className="flex justify-center py-2 text-gray-400">
            <Spinner size="sm" label="이전 메시지 로드 중" />
          </div>
        )}

        {/* 히스토리 최초 로딩 스피너 */}
        {isLoadingHistory && (
          <div className="flex justify-center items-center py-12 text-blue-500">
            <Spinner size="md" label="대화 히스토리 로드 중" />
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
          <label htmlFor="chat-input" className="sr-only">
            메시지 입력
          </label>
          <div className="flex-1 relative">
            <textarea
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_LENGTH))}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요..."
              rows={1}
              maxLength={MAX_LENGTH}
              className={`w-full px-4 py-2 border rounded-lg resize-none dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                input.length >= MAX_LENGTH ? "border-red-400" : ""
              }`}
            />
            {input.length > MAX_LENGTH * 0.8 && (
              <span
                className={`absolute right-2 bottom-1 text-xs ${
                  input.length >= MAX_LENGTH ? "text-red-500" : "text-gray-400"
                }`}
              >
                {input.length}/{MAX_LENGTH}
              </span>
            )}
          </div>
          <button
            onClick={sendMessage}
            disabled={!isConnected || !input.trim() || input.length > MAX_LENGTH}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}
