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
  const [copiedAll, setCopiedAll] = useState(false);
  const [isWaitingForAi, setIsWaitingForAi] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const {
    messages,
    hasMore,
    isLoadingHistory,
    isLoadingMore,
    historyError,
    loadMoreError,
    loadHistory,
    loadMore,
    addMessage,
    appendStreamingChunk,
    finalizeStreamingMessage,
    removeStreamingPlaceholderIfEmpty,
  } = useMessages(conversationId, token, scrollContainerRef);

  const handleChunk = useCallback(
    (delta: string) => {
      appendStreamingChunk(delta);
      setIsWaitingForAi(false); // 첫 chunk가 도착하면 thinking indicator 해제
      shouldAutoScroll.current = true;
    },
    [appendStreamingChunk]
  );

  const handleDone = useCallback(() => {
    finalizeStreamingMessage();
    setIsStreaming(false);
    setIsWaitingForAi(false);
  }, [finalizeStreamingMessage]);

  const handleCancelled = useCallback(() => {
    finalizeStreamingMessage();
    setIsStreaming(false);
    setIsWaitingForAi(false);
    setToast({ message: "응답이 취소되었습니다", type: "success" });
  }, [finalizeStreamingMessage]);

  const handleError = useCallback(
    (message: string) => {
      removeStreamingPlaceholderIfEmpty();
      setIsStreaming(false);
      setIsWaitingForAi(false);
      setToast({ message, type: "error" });
    },
    [removeStreamingPlaceholderIfEmpty]
  );

  const {
    isConnected,
    isConnecting,
    reconnectAttempt,
    sendMessage: wsSend,
    cancelStream: wsCancel,
    reconnect,
  } = useChatWebSocket(
    conversationId,
    token,
    { onChunk: handleChunk, onDone: handleDone, onCancelled: handleCancelled, onError: handleError },
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
    if (isStreaming) return; // 스트리밍 중에는 새 메시지 보내기 금지
    if (!isConnected) {
      setToast({ message: "연결이 끊겼습니다. 잠시 후 다시 시도해주세요.", type: "error" });
      return;
    }
    addMessage({ id: "", role: "user", content: input });
    wsSend(input);
    setInput("");
    setIsStreaming(true);
    setIsWaitingForAi(true);
    shouldAutoScroll.current = true;
  };

  const handleStopStream = () => {
    if (!isStreaming) return;
    wsCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isStreaming) {
        handleStopStream();
      } else {
        sendMessage();
      }
    }
  };

  const handleAddGoal = (content: string) => {
    setGoalModalContent(content);
  };

  const handleGoalSuccess = () => {
    setGoalModalContent(null);
    setToast({ message: "목표가 추가되었습니다", type: "success" });
  };

  const handleCopyAll = async () => {
    if (messages.length === 0) {
      setToast({ message: "복사할 대화가 없습니다", type: "error" });
      return;
    }
    const formatted = messages
      .map((m) => `[${m.role === "user" ? "나" : "VIVARA"}]\n${m.content}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      setToast({ message: "복사에 실패했습니다", type: "error" });
    }
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
        <h2 className="font-semibold">VIVARA</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAll}
            disabled={messages.length === 0}
            aria-label="전체 대화 복사"
            className="text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
          >
            <span>{copiedAll ? "✓" : "⎘"}</span>
            <span>{copiedAll ? "복사됨" : "대화 복사"}</span>
          </button>
          <div className="flex items-center gap-2">
            <span
              role="status"
              aria-live="polite"
              className={`text-xs px-2 py-1 rounded-full ${
                isConnecting
                  ? "bg-yellow-100 text-yellow-700"
                  : isConnected
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
              }`}
            >
              {isConnecting
                ? reconnectAttempt > 0
                  ? `재연결 중 (${reconnectAttempt})`
                  : "연결 중..."
                : isConnected
                  ? "연결됨"
                  : "연결 끊김"}
            </span>
            {!isConnected && !isConnecting && (
              <button
                onClick={reconnect}
                className="text-xs px-2 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 transition"
              >
                재연결
              </button>
            )}
          </div>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-6 space-y-4"
      >
        <div ref={loadMoreRef} className="h-1" aria-hidden="true" />

        {loadMoreError && (
          <div
            role="alert"
            className="mx-auto max-w-md p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between gap-2"
          >
            <p className="text-xs text-red-700 dark:text-red-400">{loadMoreError}</p>
            <button
              onClick={loadMore}
              className="text-xs font-medium text-red-700 dark:text-red-300 hover:underline shrink-0"
            >
              다시 시도
            </button>
          </div>
        )}

        {isLoadingMore && (
          <div className="flex justify-center py-2 text-gray-400">
            <Spinner size="sm" label="이전 메시지 로드 중" />
          </div>
        )}

        {isLoadingHistory && (
          <div className="flex justify-center items-center py-12 text-sky-500">
            <Spinner size="md" label="대화 히스토리 로드 중" />
          </div>
        )}

        {historyError && !isLoadingHistory && (
          <div
            role="alert"
            className="mx-auto max-w-md p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center"
          >
            <p className="text-sm text-red-700 dark:text-red-400 mb-2">{historyError}</p>
            <button
              onClick={loadHistory}
              className="text-xs font-medium text-red-700 dark:text-red-300 hover:underline"
            >
              다시 시도
            </button>
          </div>
        )}

        {messages.map((msg, i) => {
          const isLast = i === messages.length - 1;
          const showStreamingCursor =
            isLast && isStreaming && msg.role === "assistant" && msg.id === "streaming";
          return (
            <MessageBubble
              key={msg.id === "streaming" ? "streaming" : msg.id || `ws-${i}`}
              role={msg.role}
              content={msg.content}
              isStreaming={showStreamingCursor}
              onAddGoal={msg.role === "assistant" && !showStreamingCursor ? handleAddGoal : undefined}
            />
          );
        })}

        {/* AI 응답 대기 인디케이터 (첫 chunk 도착 전에만 표시) */}
        {isWaitingForAi && (
          <div className="flex justify-start" aria-live="polite" aria-label="AI 응답 생성 중">
            <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400 animate-pulse" />
              <span className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400 animate-pulse" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400 animate-pulse" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

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
              className={`w-full px-4 py-2 border rounded-lg resize-none dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
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
          {isStreaming ? (
            <button
              onClick={handleStopStream}
              aria-label="응답 중지"
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-1.5"
            >
              <span className="w-2.5 h-2.5 bg-white rounded-sm" aria-hidden="true" />
              <span>중지</span>
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!isConnected || !input.trim() || input.length > MAX_LENGTH}
              aria-label="메시지 전송"
              className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              전송
            </button>
          )}
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
