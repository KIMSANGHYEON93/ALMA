import { useState, useCallback, type RefObject } from "react";
import { apiClient } from "@/lib/api";

export interface Message {
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

export function useMessages(
  conversationId: string,
  token: string,
  scrollContainerRef: RefObject<HTMLDivElement | null>
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    setMessages([]);
    setHasMore(false);

    try {
      const data = await apiClient<MessagesPageResponse>(
        `/api/conversations/${conversationId}/messages?limit=20`,
        { token }
      );

      setMessages(
        data.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
      setHasMore(data.has_more);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "대화 기록 로드 실패");
    } finally {
      setIsLoadingHistory(false);
    }
  }, [conversationId, token]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || messages.length === 0) return;

    setIsLoadingMore(true);
    setLoadMoreError(null);

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
      setLoadMoreError(error instanceof Error ? error.message : "이전 메시지 로드 실패");
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, messages, conversationId, token, scrollContainerRef]);

  const addMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  /** 스트리밍 청크를 마지막 assistant 메시지에 누적.
   *  마지막 메시지가 assistant가 아니거나 없으면 새 placeholder 추가. */
  const appendStreamingChunk = useCallback((delta: string) => {
    if (!delta) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "assistant" && last.id === "streaming") {
        return [
          ...prev.slice(0, -1),
          { ...last, content: last.content + delta },
        ];
      }
      return [...prev, { id: "streaming", role: "assistant", content: delta }];
    });
  }, []);

  /** 스트리밍 종료 시 placeholder id를 실제 id로 교체(or 유지). */
  const finalizeStreamingMessage = useCallback((finalId?: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.id === "streaming") {
        return [
          ...prev.slice(0, -1),
          { ...last, id: finalId || `local-${Date.now()}` },
        ];
      }
      return prev;
    });
  }, []);

  /** 빈 streaming placeholder가 있으면 제거 (취소/에러 처리용). */
  const removeStreamingPlaceholderIfEmpty = useCallback(() => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.id === "streaming" && last.content === "") {
        return prev.slice(0, -1);
      }
      return prev;
    });
  }, []);

  return {
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
  };
}
