"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import Spinner from "./common/Spinner";
import Toast from "./common/Toast";
import ActiveGoalsBanner from "./ActiveGoalsBanner";
import AddGoalFromChatModal from "./AddGoalFromChatModal";
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
  const [goalModalContent, setGoalModalContent] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [habitReminder, setHabitReminder] = useState<string | null>(null);

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
    handleWsMessage,
    (message) => setHabitReminder(message)
  );

  const { loadMoreRef } = useInfiniteScroll(
    loadMore,
    hasMore && !isLoadingMore,
    scrollContainerRef
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      await loadHistory();
      if (!cancelled) shouldAutoScroll.current = true;
    };
    load();
    return () => { cancelled = true; };
  }, [loadHistory]);

  useEffect(() => {
    if (shouldAutoScroll.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      shouldAutoScroll.current = false;
    }
  }, [messages]);

  const MAX_LENGTH = 2000;

  const sendMessage = () => {
    if (!input.trim() || input.length > MAX_LENGTH) return;
    if (!isConnected) {
      setToast({ message: "연결이 끊겼습니다. 잠시 후 다시 시도해주세요.", type: "error" });
      return;
    }
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

  const handleAddGoal = (content: string) => {
    setGoalModalContent(content);
  };

  const handleGoalSuccess = () => {
    setGoalModalContent(null);
    setToast({ message: "목표가 추가되었습니다", type: "success" });
  };

  return (
    <div className="flex flex-col h-full">
      <ActiveGoalsBanner />
      {habitReminder && (
        <div className="mx-4 mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">습관 알림</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 whitespace-pre-line mt-1">{habitReminder}</p>
          </div>
          <button
            onClick={() => setHabitReminder(null)}
            className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 ml-2 shrink-0"
          >
            ✕
          </button>
        </div>
      )}
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
        <div ref={loadMoreRef} className="h-1" aria-hidden="true" />

        {isLoadingMore && (
          <div className="flex justify-center py-2 text-gray-400">
            <Spinner size="sm" label="이전 메시지 로드 중" />
          </div>
        )}

        {isLoadingHistory && (
          <div className="flex justify-center items-center py-12 text-blue-500">
            <Spinner size="md" label="대화 히스토리 로드 중" />
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id || `ws-${i}`}
            role={msg.role}
            content={msg.content}
            onAddGoal={msg.role === "assistant" ? handleAddGoal : undefined}
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

      {/* 목표 추가 모달 */}
      {goalModalContent && (
        <AddGoalFromChatModal
          messageContent={goalModalContent}
          onClose={() => setGoalModalContent(null)}
          onSuccess={handleGoalSuccess}
        />
      )}

      {/* 토스트 알림 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
